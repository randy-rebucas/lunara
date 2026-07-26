import { Injectable } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];

/**
 * Introspects the live Nest route table via DiscoveryService/MetadataScanner instead of a
 * hand-maintained list, so Noah's answers reflect the actual current API surface rather than
 * a doc that can drift out of date.
 */
@Injectable()
export class ApiSurfaceService {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  listModules() {
    const controllers = this.discovery.getControllers();
    const modules = new Map<string, { controller: string; basePath: string; routeCount: number }[]>();

    for (const wrapper of controllers) {
      const instance = wrapper.instance;
      if (!instance) continue;
      const prototype = Object.getPrototypeOf(instance);
      const basePath: string = this.reflector.get(PATH_METADATA, instance.constructor) ?? '';
      const moduleName = wrapper.host?.name ?? 'Unknown';
      const routeCount = this.metadataScanner
        .getAllMethodNames(prototype)
        .filter((name) => this.reflector.get(PATH_METADATA, prototype[name]) !== undefined).length;

      const list = modules.get(moduleName) ?? [];
      list.push({ controller: instance.constructor.name, basePath: `/${basePath}`.replace(/\/+/g, '/'), routeCount });
      modules.set(moduleName, list);
    }

    return [...modules.entries()].map(([module, controllers]) => ({ module, controllers }));
  }

  listRoutes(moduleFilter?: string) {
    const controllers = this.discovery.getControllers();
    const routes: { module: string; controller: string; method: string; path: string }[] = [];

    for (const wrapper of controllers) {
      const instance = wrapper.instance;
      if (!instance) continue;
      const moduleName = wrapper.host?.name ?? 'Unknown';
      if (moduleFilter && !moduleName.toLowerCase().includes(moduleFilter.toLowerCase())) continue;

      const prototype = Object.getPrototypeOf(instance);
      const basePath: string = this.reflector.get(PATH_METADATA, instance.constructor) ?? '';

      for (const methodName of this.metadataScanner.getAllMethodNames(prototype)) {
        const routePath = this.reflector.get(PATH_METADATA, prototype[methodName]);
        if (routePath === undefined) continue;
        const httpMethod = this.reflector.get(METHOD_METADATA, prototype[methodName]);
        const methodLabel = HTTP_METHODS[httpMethod] ?? 'GET';
        const fullPath = `/${basePath}/${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

        routes.push({
          module: moduleName,
          controller: instance.constructor.name,
          method: methodLabel,
          path: fullPath,
        });
      }
    }

    return routes;
  }
}
