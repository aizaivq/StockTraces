# 后台文档

## 技术栈

* 代码语言:go
* http请求框架:resty
* 数据库:PostgreSQL
* API设计规范:RESTful
* 处理http请求框架:Gin
* 内存数据库:redis
* UI框架:Ant Design

## 金融接口

https://stockapp.finance.qq.com/

- [腾讯财经接口文档 (含创业板)](tencent_finance_api.md)

## 构建

```bash
go mod init
```

## 运行

```bash
go run main.go
```

## 数据库

* 数据库名称:stock_db
* 数据库密码:123456

```bash
docker run --name stocktraces -e POSTGRES_PASSWORD=123456 -p 5432:5432 -d postgres:16
docker exec -it stocktraces psql -U postgres -d stock_db

```
