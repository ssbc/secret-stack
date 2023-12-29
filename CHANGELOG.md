# 8.0.0

- **Breaking change**: the config object now has the `config.global` namespace, and `config[pluginName]` namespace. A plugin can only access its own config, plus the global config. This is to prevent plugins from accessing each other's config, for preventive security and better code organization.

# 7.0.0

- **Breaking change**: Node.js >=16.0.0 is now required, due to the use of new JavaScript syntax
