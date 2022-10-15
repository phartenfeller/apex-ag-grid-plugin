const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    index: path.resolve(__dirname, 'src', 'index.js'),
    'index.min': path.resolve(__dirname, 'src', 'index.js'),
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ test: /\.min\.js$/ })],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
};
