# 8.1.0

- **Feature:** _Asserting dependencies between plugins_. Plugin objects can now have an optional `plugin.needs` field, which is an array of strings. Those strings are names of other plugins that the current plugin depends on. Secret-stack will throw an error if one of the specified dependencies in `plugin.needs` is missing.

# 8.0.0

- **Breaking change**: the config object now has the `config.global` namespace, and `config[pluginName]` namespace. A plugin can only access its own config, plus the global config. This is to prevent plugins from accessing each other's config, for preventive security and better code organization.

# 7.0.0

- **Breaking change**: Node.js >=16.0.0 is now required, due to the use of new JavaScript syntax
