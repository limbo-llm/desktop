import { useMutation } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type * as limbo from "limbo";
import { useMainRouter } from "../../lib/trpc";
import { buildNamespacedResourceId } from "../../lib/utils";
import { pluginBackendContext, pluginManagerContext, pluginSystemContext } from "./contexts";
import type { PluginContext } from "./core/plugin-context";
import type { ActivePlugin } from "./core/plugin-manager";
import { usePluginStore } from "./stores";

export const usePluginManager = () => {
	const pluginManager = useContext(pluginManagerContext);

	if (!pluginManager) {
		throw new Error("usePluginManager must be used within a PluginManagerProvider");
	}

	return pluginManager;
};

export const usePluginSystem = () => {
	const pluginSystem = useContext(pluginSystemContext);

	if (!pluginSystem) {
		throw new Error("usePluginSystem must be used within a PluginSystemProvider");
	}

	return pluginSystem;
};

export const usePluginBackend = () => {
	const pluginBackend = useContext(pluginBackendContext);

	if (!pluginBackend) {
		throw new Error("usePluginBackend must be used within a PluginBackendProvider");
	}

	return pluginBackend;
};

export const useActivePlugin = (pluginId: string) => {
	const pluginManager = usePluginManager();
	const [plugin, setPlugin] = useState<ActivePlugin | null>(null);

	useEffect(() => {
		setPlugin(pluginManager.getPlugin(pluginId) ?? null);

		const handleChange = () => {
			setPlugin(pluginManager.getPlugin(pluginId) ?? null);
		};

		pluginManager.events.on("plugin:added", handleChange);
		pluginManager.events.on("plugin:removed", handleChange);

		return () => {
			pluginManager.events.off("plugin:added", handleChange);
			pluginManager.events.off("plugin:removed", handleChange);
		};
	}, []);

	return plugin;
};

export const usePluginList = () => {
	const pluginMap = usePluginStore((state) => state.plugins);

	return [...pluginMap.values()];
};

export const usePluginLoader = () => {
	const pluginSystem = usePluginSystem();
	const pluginBackend = usePluginBackend();

	useEffect(() => {
		const pluginStore = usePluginStore.getState();

		async function loadPlugins() {
			const allPlugins = await pluginBackend.getAllPlugins();

			for (const plugin of allPlugins) {
				pluginStore.setPlugin(plugin.manifest.id, {
					enabled: plugin.data.enabled,
					manifest: plugin.manifest,
				});
			}

			await Promise.allSettled(
				allPlugins.map(async (plugin) => {
					try {
						await pluginSystem.loadPlugin(plugin);
					} catch {
						pluginStore.setPlugin(plugin.manifest.id, {
							manifest: plugin.manifest,
							enabled: false,
						});
					}
				})
			);
		}

		loadPlugins();
	}, []);
};

export const usePluginHotReloader = () => {
	const pluginSystem = usePluginSystem();
	const pluginBackend = usePluginBackend();

	useEffect(() => {
		const handleReloadPlugin = async (_: any, pluginId: string) => {
			const pluginStore = usePluginStore.getState();
			const freshPluginData = await pluginBackend.getPlugin(pluginId);

			pluginStore.setPlugin(pluginId, {
				manifest: freshPluginData.manifest,
				enabled: freshPluginData.data.enabled,
			});

			await pluginSystem.unloadPlugin(pluginId);
			await pluginSystem.loadPlugin(freshPluginData);
		};

		window.ipcRenderer.on("plugin:reload", handleReloadPlugin);

		return () => {
			window.ipcRenderer.off("plugin:reload", handleReloadPlugin);
		};
	}, []);
};

export const usePluginContextSettings = (pluginContext: PluginContext) => {
	const [pluginSettings, setPluginSettings] = useState<limbo.Setting[]>([]);

	useEffect(() => {
		setPluginSettings(pluginContext.getSettings());

		const handleChange = () => {
			setPluginSettings(pluginContext.getSettings());
		};

		pluginContext.events.on("state:changed", handleChange);

		return () => {
			pluginContext.events.off("state:changed", handleChange);
		};
	}, [pluginContext]);

	return pluginSettings;
};

export const useRegisteredLLMs = () => {
	const pluginManager = usePluginManager();

	const getRegisteredLLMs = useCallback(() => {
		const registeredLLMs = new Map<string, limbo.LLM>();
		const allPlugins = pluginManager.getPlugins();

		for (const plugin of allPlugins) {
			const pluginLLMs = plugin.context.getLLMs();

			for (const llm of pluginLLMs) {
				registeredLLMs.set(buildNamespacedResourceId(plugin.manifest.id, llm.id), llm);
			}
		}

		return registeredLLMs;
	}, []);

	const [registeredLLMs, setRegisteredLLMs] = useState<Map<string, limbo.LLM>>(() =>
		getRegisteredLLMs()
	);

	useEffect(() => {
		// run on first render to get the initial state (may have been empty in the use state init fn)
		setRegisteredLLMs(getRegisteredLLMs());

		const handleChange = () => {
			setRegisteredLLMs(getRegisteredLLMs());
		};

		pluginManager.events.on("plugin:added", handleChange);
		pluginManager.events.on("plugin:removed", handleChange);
		pluginManager.events.on("plugin:state-changed", handleChange);

		return () => {
			pluginManager.events.off("plugin:added", handleChange);
			pluginManager.events.off("plugin:removed", handleChange);
			pluginManager.events.off("plugin:state-changed", handleChange);
		};
	}, []);

	return registeredLLMs;
};

export const useRegisteredLLMsList = () => {
	const pluginManager = usePluginManager();

	const getLLMs = useCallback(() => {
		const plugins = pluginManager.getPlugins();

		return plugins.flatMap((plugin) => {
			const pluginLLMs = plugin.context.getLLMs();

			return pluginLLMs.map((llm) => {
				return {
					plugin,
					llm,
				};
			});
		});
	}, [pluginManager]);

	const [llms, setLLMs] = useState(() => getLLMs());

	useEffect(() => {
		const handleUpdate = () => {
			setLLMs(getLLMs());
		};

		pluginManager.events.on("plugin:added", handleUpdate);
		pluginManager.events.on("plugin:removed", handleUpdate);
		pluginManager.events.on("plugin:state-changed", handleUpdate);

		return () => {
			pluginManager.events.off("plugin:added", handleUpdate);
			pluginManager.events.off("plugin:removed", handleUpdate);
			pluginManager.events.off("plugin:state-changed", handleUpdate);
		};
	}, []);

	return llms;
};

export interface EnablePluginMutationFnOpts {
	id: string;
}

export const useEnablePluginMutation = () => {
	const pluginSystem = usePluginSystem();
	const pluginBackend = usePluginBackend();

	return useMutation({
		mutationFn: async (opts: EnablePluginMutationFnOpts) => {
			await pluginBackend.enablePlugin(opts.id);

			const plugin = await pluginBackend.getPlugin(opts.id);

			await pluginSystem.loadPlugin(plugin);

			return plugin;
		},
		onSuccess: (plugin) => {
			const pluginStore = usePluginStore.getState();

			pluginStore.setPlugin(plugin.manifest.id, {
				...plugin,
				enabled: true,
			});
		},
	});
};

export interface DisablePluginMutationFnOpts {
	id: string;
}

export const useDisablePluginMutation = () => {
	const pluginSystem = usePluginSystem();
	const pluginBackend = usePluginBackend();

	return useMutation({
		mutationFn: async (opts: DisablePluginMutationFnOpts) => {
			await pluginSystem.unloadPlugin(opts.id);
			await pluginBackend.disablePlugin(opts.id);
		},
		onSettled: (_data, _err, opts) => {
			const pluginStore = usePluginStore.getState();
			const plugin = pluginStore.getPlugin(opts.id);

			if (!plugin) {
				return;
			}

			pluginStore.setPlugin(opts.id, {
				...plugin,
				enabled: false,
			});
		},
	});
};

export interface UpdatePluginSettingsMutationFnOpts {
	id: string;
	settings: Record<string, any>;
}

export const useUpdatePluginSettingsMutation = () => {
	const pluginBackend = usePluginBackend();
	const pluginManager = usePluginManager();

	return useMutation({
		mutationFn: async (opts: UpdatePluginSettingsMutationFnOpts) => {
			await pluginBackend.updatePluginSettings(opts.id, opts.settings);
		},
		onSuccess: (_, opts) => {
			const plugin = pluginManager.getPlugin(opts.id);

			if (!plugin) {
				return;
			}

			for (const [key, value] of Object.entries(opts.settings)) {
				plugin.context.setCachedSettingValue(key, value);
			}
		},
	});
};

export const useInstallPluginMutation = () => {
	const mainRouter = useMainRouter();

	return useMutation(
		mainRouter.plugins.install.mutationOptions({
			onSuccess: (manifest) => {
				const pluginStore = usePluginStore.getState();

				pluginStore.setPlugin(manifest.id, {
					manifest,
					enabled: false, // newly installed plugins are disabled by default
				});
			},
		})
	);
};

export interface UninstallPluginMutationFnOpts {
	id: string;
}

export const useUninstallPluginMutation = () => {
	const pluginSystem = usePluginSystem();
	const pluginBackend = usePluginBackend();

	return useMutation({
		mutationFn: async (opts: UninstallPluginMutationFnOpts) => {
			await pluginSystem.unloadPlugin(opts.id);
			await pluginBackend.uninstallPlugin(opts.id);
		},
		onSuccess: async (_, opts) => {
			const pluginStore = usePluginStore.getState();

			pluginStore.removePlugin(opts.id);
		},
	});
};
