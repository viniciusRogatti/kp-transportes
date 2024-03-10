const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  externals: [nodeExternals()],
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer/"),
      "timers": require.resolve("timers-browserify"),
      "stream": require.resolve("stream-browserify")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      global: 'global',
      setImmediate: 'setImmediate',
    }),
  ],
};
