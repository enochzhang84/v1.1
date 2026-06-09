import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/signup")({
  component: SignupRedirect,
});

function SignupRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/login", replace: true });
  }, [navigate]);
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-muted-foreground mb-4">
          已切换为邮箱验证码登录，无需单独注册。首次使用的邮箱会自动创建账号。
        </p>
        <Link to="/login" className="text-primary underline">前往登录</Link>
      </div>
    </div>
  );
}
