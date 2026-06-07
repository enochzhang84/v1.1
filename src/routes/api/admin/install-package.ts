import { createFileRoute } from "@tanstack/react-router";

/**
 * VPS-only release-package installer.
 *
 * Accepts a multipart upload `package` (the hoc3-update.zip) and an `info`
 * JSON blob with parsed version metadata. On a real VPS this would:
 *   1. snapshot DB + uploads + config
 *   2. unzip package over the deployment
 *   3. run migrations / build / restart
 *   4. on failure, restore the snapshot (auto-rollback)
 *
 * On Cloudflare Workers / Lovable preview, child_process and a writable
 * filesystem are unavailable, so the endpoint returns 501 cleanly and the
 * UI surfaces the message without crashing.
 */
export const Route = createFileRoute("/api/admin/install-package")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id);
        const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
        if (!isSuper) return new Response("仅超级管理员可执行升级", { status: 403 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch (e: any) {
          return new Response("无法解析上传：" + (e?.message ?? e), { status: 400 });
        }
        const file = form.get("package");
        const infoRaw = String(form.get("info") || "{}");
        let info: { version?: string; notes?: string; released_at?: string; name?: string } = {};
        try {
          info = JSON.parse(infoRaw);
        } catch {}
        if (!(file instanceof File) || !info.version) {
          return new Response("升级包或版本信息无效", { status: 400 });
        }

        // Try to perform the real install. Will fail on Cloudflare / preview.
        let execFile: any;
        let path: any;
        let fs: any;
        try {
          execFile = (await import("node:child_process")).execFile;
          path = await import("node:path");
          fs = await import("node:fs/promises");
        } catch {
          return new Response(
            "当前运行环境不支持本地升级（仅 VPS 部署可用）。\n" +
              "请在生产服务器上执行升级。",
            { status: 501 },
          );
        }

        const log: string[] = [];
        const cwd = process.cwd();
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const backupDir = path.resolve(cwd, "..", `${path.basename(cwd)}.backup-${ts}`);
        const stageDir = path.resolve(cwd, "..", `hoc3-stage-${ts}`);
        const pkgPath = path.resolve(cwd, "..", `hoc3-update-${ts}.zip`);

        function run(cmd: string, args: string[], cwdDir = cwd): Promise<string> {
          return new Promise((resolve, reject) => {
            execFile(
              cmd,
              args,
              { cwd: cwdDir, maxBuffer: 20 * 1024 * 1024, env: process.env, timeout: 10 * 60 * 1000 },
              (err: any, stdout: string, stderr: string) => {
                const out = `$ ${cmd} ${args.join(" ")}\n${stdout || ""}${stderr ? "\n[stderr]\n" + stderr : ""}`;
                if (err) return reject(new Error(out + "\n[exit] " + err.message));
                resolve(out);
              },
            );
          });
        }

        try {
          log.push(`[1/6] 备份当前部署 → ${backupDir}`);
          await fs.cp(cwd, backupDir, {
            recursive: true,
            filter: (src: string) =>
              !src.includes("/node_modules") && !src.includes("/.git/objects"),
          });

          log.push(`[2/6] 备份数据库 / 上传文件 / 配置（占位，由部署脚本接管）`);

          log.push(`[3/6] 写入升级包 → ${pkgPath}`);
          const ab = await file.arrayBuffer();
          await fs.writeFile(pkgPath, Buffer.from(ab));

          log.push(`[4/6] 解压到暂存目录 → ${stageDir}`);
          await fs.mkdir(stageDir, { recursive: true });
          log.push(await run("unzip", ["-o", pkgPath, "-d", stageDir]));

          log.push(`[5/6] 同步新文件到部署目录`);
          log.push(
            await run("rsync", [
              "-a",
              "--delete",
              "--exclude",
              "node_modules",
              "--exclude",
              ".env",
              "--exclude",
              ".git",
              `${stageDir}/`,
              `${cwd}/`,
            ]),
          );
          log.push(await run("npm", ["install", "--no-audit", "--no-fund"]));
          log.push(await run("npm", ["run", "build"]));

          log.push(`[6/6] 重启服务`);
          const appName = process.env.PM2_APP_NAME || "";
          log.push(
            await run(
              "pm2",
              appName ? ["restart", appName, "--update-env"] : ["restart", "all", "--update-env"],
            ),
          );

          // Record version in DB
          await supabaseAdmin
            .from("app_versions")
            .update({ is_current: false })
            .eq("is_current", true);
          await supabaseAdmin.from("app_versions").insert({
            version: info.version,
            released_at: info.released_at ?? null,
            notes: info.notes ?? null,
            installed_by: userData.user.id,
            status: "success",
            is_current: true,
            package_name: info.name ?? null,
          });

          log.push(`\n✅ 升级到 ${info.version} 完成`);
          return new Response(log.join("\n"), { status: 200 });
        } catch (e: any) {
          log.push("\n❌ 升级失败，开始自动回滚...");
          try {
            const restoreCwd = cwd;
            await fs.rm(restoreCwd, { recursive: true, force: true });
            await fs.cp(backupDir, restoreCwd, { recursive: true });
            log.push("已回滚到升级前版本");
            await supabaseAdmin.from("app_versions").insert({
              version: info.version,
              released_at: info.released_at ?? null,
              notes: info.notes ?? null,
              installed_by: userData.user.id,
              status: "rolled_back",
              is_current: false,
              package_name: info.name ?? null,
              error_log: String(e?.message ?? e),
            });
          } catch (re: any) {
            log.push("⚠️ 自动回滚失败：" + (re?.message ?? re));
            log.push("请手动恢复备份：" + backupDir);
          }
          log.push(String(e?.message ?? e));
          return new Response(log.join("\n"), { status: 500 });
        }
      },
    },
  },
});
