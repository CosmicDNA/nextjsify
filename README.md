# Nextjsify

The purpose of this package is to assist in the conversion of a React app to NextJs following Vercel recommendations.

One of tasks in this process is the conversion of css files arbitrarilly imported from React components to css Modules.

This package automates this process converting css files to css modules and adjusting classNames accordingly.

## Usage example
For instance, a developer willing to convert a React application created with `CreateReactApp` can run Nextjsify to reach closer to full NextJs conversion by running the following command in its terminal:

```terminal
npx nextjsify -e "[\"src/App.css\"]"
```

where the `-e` argument instructs Nextjsify to start the conversion ignoring the global `App.css` file.