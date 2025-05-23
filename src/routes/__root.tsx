import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { createTRPCClient } from "@trpc/client";
import { Suspense, useMemo, useRef, type PropsWithChildren } from "react";
import { ipcLink } from "trpc-electron/renderer";
import type { MainRouter } from "../../electron/trpc/router";
import { useCustomStylesLoader, useCustomStylesSubscriber } from "../features/custom-styles/hooks";
import {
	PluginBackendProvider,
	PluginManagerProvider,
	PluginSystemProvider,
} from "../features/plugins/components/providers";
import type { PluginBackend } from "../features/plugins/core/plugin-backend";
import { PluginManager } from "../features/plugins/core/plugin-manager";
import { EvalPluginModuleLoader } from "../features/plugins/core/plugin-module-loader";
import { PluginSystem } from "../features/plugins/core/plugin-system";
import { usePluginHotReloader, usePluginLoader } from "../features/plugins/hooks";
import { usePluginStore } from "../features/plugins/stores";
import { useIsAppFocused } from "../hooks/common";
import { MainRouterProvider } from "../lib/trpc";
import { SideDock } from "./-components/side-dock";
import { Titlebar } from "./-components/titlebar";

export interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootLayout,
	notFoundComponent: () => {
		return (
			<div>
				<p>not found</p>
				<Link to="/chat">home</Link>
			</div>
		);
	},
});

function RootLayoutProviders({ children }: PropsWithChildren) {
	const ctx = Route.useRouteContext();

	const mainRouterClient = useMemo(() => {
		return createTRPCClient<MainRouter>({
			links: [ipcLink()],
		});
	}, []);

	const pluginManager = useMemo(() => {
		return new PluginManager();
	}, []);

	const pluginBackend = useMemo<PluginBackend>(() => {
		return {
			getPlugin: async (pluginId) => {
				return await mainRouterClient.plugins.get.query({
					id: pluginId,
				});
			},
			getAllPlugins: async () => {
				return await mainRouterClient.plugins.getAll.query();
			},
			enablePlugin: async (pluginId) => {
				return await mainRouterClient.plugins.updateEnabled.mutate({
					id: pluginId,
					enabled: true,
				});
			},
			disablePlugin: async (pluginId) => {
				return await mainRouterClient.plugins.updateEnabled.mutate({
					id: pluginId,
					enabled: false,
				});
			},
			updatePluginSettings: async (pluginId, settings) => {
				return await mainRouterClient.plugins.updateSettings.mutate({
					id: pluginId,
					settings,
				});
			},
			uninstallPlugin: async (pluginId) => {
				return await mainRouterClient.plugins.uninstall.mutate({
					id: pluginId,
				});
			},
		};
	}, []);

	const pluginSystem = useMemo(() => {
		return new PluginSystem({
			pluginManager,
			pluginModuleLoader: new EvalPluginModuleLoader(),
			hostBridge: {
				onActivatePluginError: (pluginId, errorMsg) => {
					console.error(`Failed to activate plugin ${pluginId}: Error: ${errorMsg}`);
				},
			},
			pluginAPIBridge: {
				getChat: async (chatId) => {
					return await mainRouterClient.chats.get.query({
						id: chatId,
					});
				},
				getChatMessages: async (opts) => {
					return await mainRouterClient.chats.messages.getMany.query(opts);
				},
				renameChat: async (chatId, newName) => {
					await mainRouterClient.chats.rename.mutate({
						id: chatId,
						name: newName,
					});
				},
				showNotification: async (notification) => {
					// todo show notification for real
				},
			},
		});
	}, []);

	return (
		<QueryClientProvider client={ctx.queryClient}>
			<MainRouterProvider trpcClient={mainRouterClient} queryClient={ctx.queryClient}>
				<PluginBackendProvider pluginBackend={pluginBackend}>
					<PluginSystemProvider pluginSystem={pluginSystem}>
						<PluginManagerProvider pluginManager={pluginManager}>
							{children}
						</PluginManagerProvider>
					</PluginSystemProvider>
				</PluginBackendProvider>
			</MainRouterProvider>
		</QueryClientProvider>
	);
}

const useRendererLoader = () => {
	const areCutomStylesLoaded = useRef(false);

	const checkLoaded = () => {
		if (!areCutomStylesLoaded.current) {
			return;
		}

		// notify the main process that the renderer is ready
		window.ipcRenderer.send("renderer:ready");
	};

	useCustomStylesLoader({
		onFinished: () => {
			areCutomStylesLoaded.current = true;

			checkLoaded();
		},
	});
};

const MainContent = () => {
	useRendererLoader();
	useCustomStylesSubscriber();

	usePluginLoader();
	usePluginHotReloader();

	return (
		<div className="app-row">
			<SideDock />
			<div className="app-content">
				<Outlet />
			</div>
		</div>
	);
};

function RootLayout() {
	const appIsFocused = useIsAppFocused();

	return (
		<RootLayoutProviders>
			<div className="app" data-app-focused={appIsFocused}>
				<Titlebar />
				<Suspense fallback={"loading, todo replace"}>
					<MainContent />
				</Suspense>
			</div>
		</RootLayoutProviders>
	);
}
