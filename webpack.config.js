const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Extension configuration
const extensionConfig = {
  target: 'node',
  mode: 'none',
  
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  
  externals: {
    vscode: 'commonjs vscode'
  },
  
  resolve: {
    extensions: ['.ts', '.js']
  },
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'resources/**/*',
          to: '[path][name][ext]'
        },
        {
          from: 'node_modules/source-map/lib/mappings.wasm',
          to: 'mappings.wasm'
        }
      ]
    })
  ],
  
  devtool: 'nosources-source-map',
  
  infrastructureLogging: {
    level: 'log'
  }
};

// Webview configuration
const webviewConfig = {
  target: 'web',
  mode: 'none',
  
  entry: {
    'viewer/index': './webview/viewer/index.ts',
    'editor/index': './webview/editor/index.ts',
  },
  
  output: {
    path: path.resolve(__dirname, 'out', 'webview'),
    filename: '[name].js'
  },
  
  resolve: {
    extensions: ['.ts', '.js']
  },
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'webview', 'tsconfig.json')
            }
          }
        ]
      }
    ]
  },
  
  devtool: 'nosources-source-map'
};

module.exports = [extensionConfig, webviewConfig];