安装、运行
============

安装

```shell
npm -g install proxy-tcp
```

运行：推荐使用 [pm2](http://pm2.keymetrics.io/)

第一个参数为配置文件的路径，其中 .mapping 中设置端口映射关系。

### by pm2

```shell
cd `npm -g root`/proxy-tcp
pm2 start . --name proxy-tcp --instances 2 -- "./example/pm2.json"
```

or

```shell
pm2 start `npm -g root`/proxy-tcp/example/pm2.json
```

edit pm2.json, change mapping part to meet your requirement.


### direct from shell

```
proxy-tcp `npm -g root`/proxy-tcp/example/pm2.json
```

introduce
===========

连接内网被屏蔽互联网访问的 tcp 服务，如 oracle

```text
                               (directly)
                          / -------------------> \
client ------> proxy-tcp                          target(TCP server)
             (TCP server) \ --- http tunnel ---> /
                                    ^
               (http server that accept method:connect request)
```

客户端侧启动 port mapper，将连接到本地端口的连接接续到最终目标监听地址，包括两种方式：

1. 直接通过 net.connect 接续到目标地址
2. 间接通过 http.request({method:'connect',...} 通过 http tunnel 来连接目标地址

配置数据格式，形如

```json
"mapping": {
  "127.0.0.1:6003": {
    "target": "qhtdb1:61521",
    "proxy": "localhost:80"
  },
  ":6001": {
    "target": "qhtdb1:61521"
  }
}
```

```text
mapping := (
    key: {
        target: "host:port",
        proxy?: "host:port"
    }
)
```

1. key 为监听地址，格式如 ip:port，其中ip为监听多个地址中的那个地址，可以为空(默认监听所有地址)
2. 配置项中有 proxy 的代表要通过 http tunnel 接续，target 地址必须是 http tunnel proxy 可以解析和访问的地址
3. 配置项中没有 proxy 的代表要直接连接最终目标地址，target 地址必须是本 tcp proxy 可以解析和访问的地址

use cases
==========

In DMZ
------------

在 DMZ 区域，防火墙策略经常是内网地址到外网地址之间双向不能直接连接，
只能通过 DMZ 区的地址间接连接。

通过本代理，一方比如说外部要想访问内部服务，可以采用如下方案：

1. 在 DMZ 区域启动本代理，配置本地端口(外网地址)到内网地址(host:port)的映射关系
2. 原外网客户端配置访问代理外网地址和端口即可访问到内网服务

意义：

1. 在DMZ 部署带有应用逻辑的软件不方便，因为受到网络访问限制，更新调试都受到影响
2. 有了本代理，将DMZ两侧TCP连接接续，又不破坏企业的防火墙配置策略，避免和运维单位人员冲突
3. 对于内外侧的网络应用程序，开发时完全不用考虑DMZ的影响，只当是可以直连，不必修改架构

with DMZ http tunnel
--------------------

如果 DMZ 防火墙策略规定只能留一个对外部监听端口，
那么可以部署一个一次性且配置不会改变的 http tunnel(参考 [uniproxy](https://github.com/kaven276/uniproxy))，
然后再外网部署本TCP代理，配置通过 http tunnel 代理连接到目的内网地址。
这样，以后不管添加多少网络接续配置，都不用去DMZ对 http tunnel 做任何变动，
只要在外网修改本TCP代理的配置即可，维护十分方便。


hide internal TCP service behind firewall, access through exposed http service
-------------

很多时候，组织内部网络中的服务，特别是http服务，通过一个统一的对外 reverse http server 来访问，
外部互联网用户访问该组织的服务，都先访问该对外http服务，并由之反向代理到内部http服务。
但是，当一些内部服务，如 oracle service，他是基于 TCP 而不是 http 的，
那么默认情况下，oracle client 端软件只能直接发出TCP数据，无法使用 http tunnel。
因此，可以做以下三项工作来弥补：

1. 网关http service支持 http tunnel，将 connect host:port 请求代理到内部目标TCP服务
2. 客户端侧启动本代理，将本地端口映射为访问http tunnel再转到目标内部TCP服务地址
3. 客户端从原来的直接指定目标地址，转变为指定本代理的监听地址
