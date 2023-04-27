const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { DefinePlugin } = require('webpack');

const entry = path.resolve(__dirname, 'src', 'index.js');

module.exports = (env) => {
  const offlineMode = !!env.offline;
  // eslint-disable-next-line no-console
  console.log('Offline mode enabled:', env.offline);

  return {
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
    plugins: [
      new MiniCssExtractPlugin({ filename: 'index.css' }),
      new DefinePlugin({ OFFLINE_MODE: offlineMode }),
    ],
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({ test: /\.min\.js$/ }),
        new CssMinimizerPlugin({ test: /\.min\.css$/ }),
      ],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
  };
};
