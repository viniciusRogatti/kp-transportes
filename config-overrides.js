module.exports = function override(config) {
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    timers: require.resolve('timers-browserify'),
    stream: require.resolve('stream-browserify'),
  };

  const zxingPathPattern = /node_modules[\\/]@zxing[\\/]/;

  const appendExclude = (rule) => {
    if (!rule) return;

    if (!rule.exclude) {
      rule.exclude = [zxingPathPattern];
      return;
    }

    if (Array.isArray(rule.exclude)) {
      rule.exclude = [...rule.exclude, zxingPathPattern];
      return;
    }

    rule.exclude = [rule.exclude, zxingPathPattern];
  };

  const patchSourceMapLoaderRule = (rule) => {
    if (!rule) return;

    const loader = String(rule.loader || '');
    if (loader.includes('source-map-loader')) {
      appendExclude(rule);
    }

    if (Array.isArray(rule.use)) {
      const hasSourceMapLoader = rule.use.some((item) => {
        const useLoader = String(item?.loader || item || '');
        return useLoader.includes('source-map-loader');
      });

      if (hasSourceMapLoader) {
        appendExclude(rule);
      }
    }

    if (Array.isArray(rule.oneOf)) {
      rule.oneOf.forEach(patchSourceMapLoaderRule);
    }

    if (Array.isArray(rule.rules)) {
      rule.rules.forEach(patchSourceMapLoaderRule);
    }
  };

  if (Array.isArray(config.module?.rules)) {
    config.module.rules.forEach(patchSourceMapLoaderRule);
  }

  const zxingSourceMapWarningMatcher = (warning) => {
    const message = String(warning?.message || '');
    const modulePath = String(warning?.module?.resource || '');

    if (!message.includes('Failed to parse source map')) return false;
    return message.includes('/node_modules/@zxing/') || modulePath.includes('/node_modules/@zxing/');
  };

  config.ignoreWarnings = [...(config.ignoreWarnings || []), zxingSourceMapWarningMatcher];

  return config;
};
