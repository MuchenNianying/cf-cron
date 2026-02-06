-- 添加请求头和请求体字段到 tasks 表
ALTER TABLE tasks ADD COLUMN request_headers TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN request_body TEXT NOT NULL DEFAULT '';
