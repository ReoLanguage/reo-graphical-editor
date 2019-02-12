const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

let isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	mode: isProduction ? 'production' : 'development',
	entry: {
		"app": './src/editor.js'
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'public')
	},
	node: {module: "empty", net: "empty", fs: "empty"},
	optimization: isProduction ? {} : {
		minimizer: [
			new TerserPlugin({
				terserOptions: {
					compress: {
						drop_console: true,
						unsafe: true
					}
				}
			})
		]
	},
	module: {
		rules: [{
			test: /\.css$/,
			use: ['style-loader', 'css-loader']
		}]
	},
	plugins: [
		new MonacoWebpackPlugin({languages: ['reo']})
	]
};
