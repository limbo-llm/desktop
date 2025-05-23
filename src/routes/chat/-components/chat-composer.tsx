import { useParams, useRouter } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { ArrowUpIcon } from "lucide-react";
import { useMemo, useState, type Ref } from "react";
import { Controller, useForm } from "react-hook-form";
import TextareaAutosize from "react-textarea-autosize";
import { useShallow } from "zustand/shallow";
import { Button } from "../../../components/button";
import { IconButton } from "../../../components/icon-button";
import {
	MenuContent,
	MenuItem,
	MenuPositioner,
	MenuRoot,
	MenuTrigger,
} from "../../../components/menu";
import { TextInput } from "../../../components/text-input";
import { useCreateChatMutation } from "../../../features/chat/hooks/queries";
import { useSendMessage } from "../../../features/chat/hooks/use-send-message";
import { useChatStore } from "../../../features/chat/stores";
import {
	usePluginManager,
	useRegisteredLLMs,
	useRegisteredLLMsList,
} from "../../../features/plugins/hooks";
import { useLocalStore } from "../../../features/storage/stores";
import { buildNamespacedResourceId } from "../../../lib/utils";

// TODO, make sure this component has a clear structure in the styling system
const LLMPicker = () => {
	const llms = useRegisteredLLMsList();
	const [search, setSearch] = useState("");

	const fuse = useMemo(() => {
		return new Fuse(llms, {
			threshold: 0.3,
			ignoreLocation: true,
			keys: ["plugin.manifest.id", "plugin.manifest.name", "llm.id", "llm.name"],
		});
	}, [llms]);

	const filteredLLMs = useMemo(() => {
		if (!search) {
			return llms;
		}

		return fuse.search(search).map((item) => item.item);
	}, [fuse, search, llms]);

	const localStore = useLocalStore(
		useShallow((state) => ({
			selectedModel: state.selectedModel,
			setSelectedModel: state.setSelectedModel,
		}))
	);

	const registeredLLMs = useRegisteredLLMs();

	const selectedLLM = useMemo(() => {
		if (!localStore.selectedModel) {
			return null;
		}

		return registeredLLMs.get(localStore.selectedModel) ?? null;
	}, [registeredLLMs, localStore.selectedModel]);

	return (
		<MenuRoot>
			<MenuTrigger asChild>
				<Button variant="ghost" color="secondary">
					{selectedLLM ? selectedLLM.name : "Select model"}
				</Button>
			</MenuTrigger>
			<MenuPositioner>
				<MenuContent>
					<TextInput
						placeholder="Search models..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<div>
						{filteredLLMs.map((llm) => {
							const namespacedId = buildNamespacedResourceId(
								llm.plugin.manifest.id,
								llm.llm.id
							);

							return (
								<MenuItem
									value={namespacedId}
									onClick={() => localStore.setSelectedModel(namespacedId)}
									key={namespacedId}
								>
									{llm.llm.name}
								</MenuItem>
							);
						})}
					</div>
				</MenuContent>
			</MenuPositioner>
		</MenuRoot>
	);
};

export interface ChatComposerProps {
	ref?: Ref<HTMLDivElement>;
}

export const ChatComposer = ({ ref }: ChatComposerProps) => {
	const router = useRouter();
	const pluginManager = usePluginManager();
	const sendMessage = useSendMessage();
	const createChatMutation = useCreateChatMutation();

	// may need to read more from chat store here later, that's why I'm ising useShallow, even if it's unecessary for now
	const chatStore = useChatStore(
		useShallow((state) => ({
			isAssistantResponsePending: state.isAssistantResponsePending,
		}))
	);

	const localStore = useLocalStore(
		useShallow((state) => ({
			selectedModel: state.selectedModel,
		}))
	);

	const params = useParams({
		strict: false,
	});

	const form = useForm({
		defaultValues: {
			message: "",
		},
	});

	const onSubmit = form.handleSubmit(async (data) => {
		if (!localStore.selectedModel) {
			return;
		}

		form.reset();

		let chatId;

		if (typeof params.id === "string") {
			chatId = params.id;
		} else {
			const newChat = await createChatMutation.mutateAsync({
				name: "New chat",
			});

			chatId = newChat.id;

			await pluginManager.executeOnAfterChatCreatedHooks({
				chatId: newChat.id,
			});

			await router.navigate({
				to: "/chat/$id",
				params: {
					id: newChat.id.toString(),
				},
			});
		}

		try {
			await sendMessage({
				chatId: chatId,
				message: data.message,
			});
		} catch (err) {
			// If sending message fails, we can add the message back to the form
			form.setValue("message", data.message);
		}
	});

	const message = form.watch("message");
	const canSendMessage = message.length > 0 && !chatStore.isAssistantResponsePending;

	return (
		<div className="chat-composer" ref={ref}>
			<form className="chat-composer-form" onSubmit={onSubmit}>
				<Controller
					name="message"
					control={form.control}
					rules={{
						minLength: 1,
					}}
					render={({ field }) => (
						<TextareaAutosize
							autoFocus
							className="chat-composer-input"
							placeholder="Type your message here..."
							value={field.value}
							onBlur={field.onBlur}
							onChange={(e) => field.onChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();

									onSubmit();
								}
							}}
						/>
					)}
				></Controller>
				<IconButton type="submit" color="secondary" disabled={!canSendMessage}>
					<ArrowUpIcon />
				</IconButton>
			</form>
			<div className="chat-composer-accessories">
				<LLMPicker />
			</div>
		</div>
	);
};
