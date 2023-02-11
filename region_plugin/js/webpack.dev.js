const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'src', 'index.js'),
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
    }),
    new MiniCssExtractPlugin({ filename: 'index.css' }),
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
    open: false,
    client: {
      webSocketURL: 'ws://localhost:8080/ws',
    },
    hot: false,
    liveReload: true,
    static: {
      directory: path.join(__dirname, 'demo'),
      watch: true,
      serveIndex: true,
    },
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    allowedHosts: ['localhost', '.phartenfeller.de'],
  },
};
