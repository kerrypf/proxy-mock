
var http = require('http'),
	request = require('request'),
	colors = require('colors'),
	querystring = require('querystring'),
	finalhandler = require('finalhandler'),
	router = require('router')(),
	async = require('async'),
	mime = require('mime'),
	mock_data = require('./mock/mock-data'),
	config = require('./config'),

	get_parse = require('./common/get-parse'),
	promise_param = require('./common/promise-param'),
	
	staticSource = require('./common/static-source'),
	expires = require('./common/expires'),
	redirect = require('./common/redirect'),

	config_proxy = require('./config-proxy')





module.exports = function (port) {

	var server = http.createServer()

	server.on('request',(req,res)=>{

		if( ~req.url.indexOf('favicon.ico') ) {
			res.end('')
			return
		}

		router(req, res, finalhandler(req, res))

	})
	server.listen(port)




	/** 
	 * [静态文件处理]
	 *  若配置 nginx ，则有 nginx 处理
	 */
	router.use((req, res,next) => {
		
		var file_path = get_parse(req.url).getPath()
		console.log((file_path).gray,STATIC_SOURCE.indexOf(mime.lookup(file_path)))
		
		// 静态文件过滤
		if(~STATIC_SOURCE.indexOf(mime.lookup(file_path))){
			async.series([
				// 设置缓存 ，已缓存、304
				callback=>{ expires(req,res,file_path,callback)},
				// 304 不执行
				callback=>{ staticSource.sendStaticSource(file_path,res)}
			])
		}else{
			next()
		}
		
	})

	router.use( (req, res,next) => {
		// console.log(req.headers)

		if(req.headers.mock){
			
			mock_fn(req,res)
		}else{
			request_method(req,res)
		}
		
	})

	/**
	 * [mock 数据]
	 */
	 var mock_fn = function (req,res) {

	 	promise_param(req).then(data=>{

	 		if(typeof data === 'string'){
	 			// console.log(data)
	 			data = JSON.parse(data)
	 			// console.log(data)
	 		}

	 		data = mock_data(data)
	 		// console.log(data)
	 		res.writeHead(200,{
	  			'content-type':'application/json;charset=utf8'
	  		})
	 		res.end(JSON.stringify(data))

	 	})

	 }



	/**
	 * [请求方法]
	 */
	var request_method = (req,res)=>{

		promise_param(req).then(data=>{
			proxy_request(req,res,data)
		})
	}

	/**
	 * [代理请求]
	 */
	var proxy_request = (req,res,data)=>{
		// console.log(req.query_param)
				
		var headers = {}

		for(var k in req.headers){
			if(req.headers.hasOwnProperty(k) && !~config_proxy.indexOf(k)){
				headers[k] = req.headers[k]
			}
		}

		
		var options = {
	        method:req.method,
	        url:req.headers.domain+req.url,
	        headers:headers
	    }
		if(req.headers['content-type']){
			switch(true){
				case req.headers['content-type'].indexOf('application/json')!=-1:
					options.body = data
				break;
				case req.headers['content-type'].indexOf('x-www-form')!=-1:
					options.form = data
				break;
			}
			
		}

		console.log((req.headers.domain+req.url).green)
		console.log(typeof data === 'string' ? (data).yellow : (JSON.stringify(data)).yellow)

		request(options).pipe(res)

	}

}
