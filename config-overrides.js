module.exports = function override(config, env) {
  // Adicione as alterações de resolução aqui
  config.resolve.fallback = {
    "buffer": require.resolve("buffer/"),
    "timers": require.resolve("timers-browserify"),
    "stream": require.resolve("stream-browserify")
  };

  return config;
}
