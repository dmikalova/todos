// Lint plugin: prevents Deno.env usage outside of src/config.ts
// All environment variable access should go through the centralized config module.

const plugin: Deno.lint.Plugin = {
  name: "project-rules",
  rules: {
    "no-deno-env": {
      create(context) {
        // Only enforce within src/ (not tests, scripts, etc.)
        // Allow Deno.env in config.ts
        if (
          !context.filename.includes("/src/") ||
          context.filename.endsWith("src/config.ts")
        ) {
          return {};
        }

        return {
          // Match Deno.env.get(...), Deno.env.set(...), Deno.env.has(...), Deno.env.delete(...)
          'MemberExpression[object.type="MemberExpression"][object.object.name="Deno"][object.property.name="env"]'(
            node: Deno.lint.MemberExpression,
          ) {
            context.report({
              node,
              message:
                "Deno.env access is only allowed in src/config.ts. Use getConfig() from ./config.ts instead.",
            });
          },
        };
      },
    },
  },
};

export default plugin;
