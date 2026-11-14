module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'web-no-service-internals',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^(services|scripts|infra)/' },
    },
    {
      name: 'service-no-web',
      severity: 'error',
      from: { path: '^services/' },
      to: { path: '^(apps|scripts|infra)/' },
    },
    {
      name: 'packages-stay-independent',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps|services|scripts|infra)/' },
    },
    {
      name: 'domain-stays-independent',
      severity: 'error',
      from: { path: '^services/[^/]+/src/modules/[^/]+/domain/' },
      to: {
        path: '(/(adapters|infrastructure|presentation)/|^(apps|scripts|infra)/)',
      },
    },
    {
      name: 'use-api-public-entry',
      severity: 'error',
      from: { pathNot: '^services/api/' },
      to: {
        path: '^services/api/src/',
        pathNot: '^services/api/src/index\\.mjs$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|build|coverage)/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default'],
    },
  },
};
