const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const entry = path.resolve(__dirname, 'src', 'index.js');

module.exports = {
  entry: {
    index: entry,
    'index.min': entry,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin(), new MiniCssExtractPlugin()],
  optimization: {
    minimize: false,
  },
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  devServer: {
    open: false,
    hot: 'only',
    liveReload: true,
    webSocketServer: false,
  },
};
