module.exports = function override(config) {
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    timers: require.resolve('timers-browserify'),
    stream: require.resolve('stream-browserify'),
  };
  return config;
};
