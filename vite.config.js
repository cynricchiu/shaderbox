import { defineConfig } from 'vite';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import packageJson from './package.json';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ command, mode, ssrBuild }) => {
	const common = {
		publicDir: 'public',
		resolve: {
			alias: {
				'@styles': path.resolve(__dirname, './src/assets/styles'),
				'@images': path.resolve(__dirname, './src/assets/images'),
				'@data': path.resolve(__dirname, './src/assets/data'),
				'@js': path.resolve(__dirname, './src/assets/js'),
			},
		},
		plugins: [
			ViteEjsPlugin({
				title: format(packageJson.name),
				params: JSON.stringify({
					demoList: getHtmlTree('./demos'),
				}).replaceAll('\\', '\\\\'), // 转成字符串才能传递给ejs，且路径中的\\替换成\\\\才能正确JSON.parse
			}),
		],
		devServer: {
			host: 'localhost',
			port: '8080',
			proxy: {
				'': {
					// /api 表示拦截以/api开头的请求路径
					// target: 'http://music.163.com', // 跨域的域名
					changeOrigin: true, // 是否开启跨域
				},
			},
		},
	};
	if (command === 'serve') {
		// dev
		return {
			...common,
			server: {
				host: 'localhost',
				port: '8080',
				open: true,
				https: false,
				cors: true,
			},
			build: {
				rollupOptions: {
					input: {
						index: path.resolve(__dirname, 'index.html'),
					},
				},
			},
		};
	} else {
		if (mode !== 'lib') {
			// command === 'build'
			return {
				...common,
				// 打包配置
				build: {
					target: 'modules',
					outDir: 'dist', //指定输出路径
					assetsDir: 'assets', // 指定生成静态资源的存放路径
					minify: 'esbuild',
					rollupOptions: {
						input: path.resolve(__dirname, './src/assets/js/main.js'), // 打包入口文件
						output: {
							// 最小化拆分包
							manualChunks: id => {
								if (id.includes('node_modules')) {
									return id.toString().split('node_modules/')[1].split('/')[0].toString();
								}
							},
							entryFileNames: 'js/[name].[hash].js',
							chunkFileNames: 'js/[name].[hash].js',
							assetFileNames: '[ext]/[name].[hash].[ext]',
							globals: {
								// react: 'React', // UMD构建模式下为依赖提供一个全局变量
							},
						},
						// external: ['react'], // 不打包依赖
					},
				},
			};
		} else {
			// build环境，但是lib模式
			const libName = `${packageJson.name}-lib`;
			return {
				...common,
				// 打包配置
				build: {
					target: 'modules',
					outDir: 'dist', //指定输出路径
					assetsDir: 'assets', // 指定生成静态资源的存放路径
					minify: 'esbuild',
					lib: {
						entry: path.resolve(__dirname, './src/assets/js/main.js'),
						name: libName,
						fileName: format => `${libName}.${format}.js`,
					},
				},
			};
		}
	}
});

// 仅将目录下有.html的识别为node
const isNodeDir = dirPath => {
	dirPath = path.resolve(__dirname, dirPath);
	if (fs.statSync(dirPath).isDirectory()) {
		const files = fs.readdirSync(dirPath);
		return !!files.find(file => {
			return path.extname(file).toLocaleLowerCase() === '.html';
		});
	}
	return false;
};

// 根据根节点构造目录树
const buildTree = root => {
	if (isNodeDir(root.path)) {
		const files = fs.readdirSync(root.path);
		files.forEach((file, i) => {
			const child = {
				name: format(file),
				path: path.join(root.path, file),
				children: [],
				index: `${root.index}-${i}`,
			};
			if (path.extname(file).toLocaleLowerCase() === '.html' || isNodeDir(child.path)) {
				root.children.push(child);
			}
			buildTree(child);
		});
	}
};

// 将demos目录结构组织为树形JSON
const getHtmlTree = dirPath => {
	if (isNodeDir(dirPath)) {
		const dirName = path.basename(dirPath);
		const root = {
			name: format(dirName), // 文件名遵循首字母大写规则
			path: dirPath,
			children: [],
			index: 0,
		};
		buildTree(root);
		return root;
	}
	return null;
};

// 首字母大写
const format = str => {
	return str.toLowerCase().replace(/( |^)[a-z]/g, letter => letter.toUpperCase());
};
