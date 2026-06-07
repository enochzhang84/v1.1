import { createFileRoute } from "@tanstack/react-router";

/**
 * VPS-only self-update endpoint.
 *
 * Runs:
 *   1. backup current project dir → ../<name>.backup-<ts>
 *   2. git fetch && git pull
 *   3. npm install
 *   4. npm run build
 *   5. pm2 restart <APP_NAME>  (or `pm2 restart all` if APP_NAME unset)
 *
 * Auth:
 *   - Requires a logged-in super_admin (verified via Supabase bearer token).
 *
 * Notes:
 *   - This will only succeed on a self-hosted VPS where child_process,
 *     git, npm, and pm2 are available. On Cloudflare Workers / Lovable
 *     preview the spawn calls fail and the endpoint returns 500 — the
 *     panel hides the "立即更新" button there.
 */
export const Route = createFileRoute("/api/admin/self-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        // Verify super_admin via Supabase
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
          if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id);
          const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
          if (!isSuper) return new Response("Forbidden: super_admin only", { status: 403 });
        } catch (e: any) {
          return new Response("Auth check failed: " + (e?.message ?? e), { status: 500 });
        }

        // Dynamically import Node-only modules so build doesn't fail on Workers
        let execFile: any;
        let path: any;
        let fs: any;
        try {
          execFile = (await import("node:child_process")).execFile;
          path = await import("node:path");
          fs = await import("node:fs/promises");
        } catch (e: any) {
          return new Response(
            "此环境不支持 shell 操作（仅 VPS 部署可用）: " + (e?.message ?? e),
            { status: 500 },
          );
        }

        const cwd = process.cwd();
        const appName = process.env.PM2_APP_NAME || "";
        const branch = "main";

        function run(cmd: string, args: string[], cwdDir = cwd): Promise<string> {
          return new Promise((resolve, reject) => {
            try {
              execFile(
                cmd,
                args,
                { cwd: cwdDir, maxBuffer: 10 * 1024 * 1024, env: process.env, timeout: 5 * 60 * 1000 },
                (err: any, stdout: string, stderr: string) => {
                  const out = `$ ${cmd} ${args.join(" ")}\n${stdout || ""}${stderr ? "\n[stderr]\n" + stderr : ""}`;
                  if (err) return reject(new Error(out + "\n[exit] " + err.message));
                  resolve(out);
                },
              );
            } catch (e: any) {
              reject(e);
            }
          });
        }

        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const backupDir = path.resolve(cwd, "..", `${path.basename(cwd)}.backup-${ts}`);
        const log: string[] = [];

        try {
          log.push(`[1/5] 备份当前版本 → ${backupDir}`);
          await fs.cp(cwd, backupDir, {
            recursive: true,
            filter: (src: string) =>
              !src.includes("/node_modules") && !src.includes("/.git/objects"),
          });
          log.push("备份完成");

          log.push("\n[2/5] git fetch / pull");
          log.push(await run("git", ["fetch", "--all", "--prune"]));
          log.push(await run("git", ["pull", "--ff-only", "origin", branch]));

          log.push("\n[3/5] npm install");
          log.push(await run("npm", ["install", "--no-audit", "--no-fund"]));

          log.push("\n[4/5] npm run build");
          log.push(await run("npm", ["run", "build"]));

          log.push("\n[5/5] pm2 restart");
          log.push(
            await run("pm2", appName ? ["restart", appName, "--update-env"] : ["restart", "all", "--update-env"]),
          );

          log.push("\n✅ 更新成功");
          return new Response(log.join("\n"), {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (e: any) {
          log.push("\n❌ 更新失败，已保留当前可运行版本（备份位于 " + backupDir + "）");
          log.push(String(e?.message ?? e));
          return new Response(log.join("\n"), {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
