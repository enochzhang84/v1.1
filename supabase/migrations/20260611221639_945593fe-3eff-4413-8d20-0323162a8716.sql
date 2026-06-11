-- 补充 qr_registry 系统二维码项目（幸福聊天室、自定义链接），并统一成人主日学命名
INSERT INTO public.qr_registry (name, route_path, module, is_system, sort_order) VALUES
  ('幸福聊天室', '/chat', 'chat', true, 90),
  ('自定义链接', '/custom', 'custom', true, 999)
ON CONFLICT (route_path) DO NOTHING;

UPDATE public.qr_registry SET name = '暑期成人主日学' WHERE route_path = '/adult-checkin/summer';
UPDATE public.qr_registry SET name = '秋季成人主日学' WHERE route_path = '/adult-checkin/fall';
UPDATE public.qr_registry SET name = '主日学签到' WHERE route_path = '/sunday-checkin';
UPDATE public.qr_registry SET name = '团契与小组签到' WHERE route_path = '/fellowship-checkin';