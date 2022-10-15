const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'src', 'index.js'),
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
    }),
  ],
  optimization: {
    minimize: false,
  },
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'demo'),
    filename: 'index.js',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'demo'),
      watch: true,
    },
  },
};
