import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextCoreWebVitals,
  {
    rules: {
      // Standard data-fetch-on-mount patterns trigger this in React 19 lint presets.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
