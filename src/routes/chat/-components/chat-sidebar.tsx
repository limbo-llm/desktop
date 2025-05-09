import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useMatch, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { EllipsisIcon, MessageCirclePlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import {
	Sidebar,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupTitle,
	SidebarItem,
} from "../../../components/sidebar";
import { iconButtonVariants } from "../../../components/icon-button";
import { useMainRouter } from "../../../lib/trpc";
import {
	MenuContent,
	MenuItem,
	MenuPositioner,
	MenuRoot,
	MenuTrigger,
} from "../../../components/menu";
import {
	DialogCloseButton,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
	type DialogRootProps,
} from "../../../components/dialog";
import { Button } from "../../../components/button";
import { TextInput } from "../../../components/text-input";
import { removeChatFromQueryCache, updateChatInQueryCache } from "../../../features/chat/utils";

interface RenameChatDialogProps {
	dialogProps: Omit<DialogRootProps, "children">;
	chat: {
		id: string;
		name: string;
	};
}

const RenameChatDialog = ({ chat, dialogProps }: RenameChatDialogProps) => {
	const mainRouter = useMainRouter();
	const queryClient = useQueryClient();
	const renameChatMutation = useMutation(mainRouter.chats.rename.mutationOptions());

	const form = useForm({
		values: {
			name: chat.name,
		},
	});

	const onSubmit = form.handleSubmit((data) => {
		renameChatMutation.mutate(
			{
				id: chat.id,
				name: data.name,
			},
			{
				onSuccess: (updatedChat) => {
					updateChatInQueryCache(queryClient, mainRouter, updatedChat);

					if (dialogProps.onOpenChange) {
						dialogProps.onOpenChange({ open: false });
					}
				},
				onError: () => {
					// show toast
				},
			}
		);
	});

	return (
		<DialogRoot {...dialogProps}>
			<DialogContent>
				<DialogCloseButton />
				<DialogHeader>
					<DialogTitle>Rename chat</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit}>
					<TextInput placeholder="Enter a name" {...form.register("name")} />
					<DialogFooter>
						<DialogCloseTrigger asChild>
							<Button variant="ghost" color="secondary">
								Cancel
							</Button>
						</DialogCloseTrigger>
						<Button
							type="submit"
							color="primary"
							disabled={!form.formState.isDirty}
							isLoading={renameChatMutation.isPending}
						>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</DialogRoot>
	);
};

interface ChatItemProps {
	chat: {
		id: string;
		name: string;
	};
}

// TODO, fix the issue of the chat link navigating when the menu trigger is clicked
const ChatItem = ({ chat }: ChatItemProps) => {
	const router = useRouter();
	const queryClient = useQueryClient();
	const mainRouter = useMainRouter();
	const deleteChatMutation = useMutation(mainRouter.chats.delete.mutationOptions());
	const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

	const match = useMatch({
		strict: false,
	});

	const handleDelete = () => {
		deleteChatMutation.mutate(
			{ id: chat.id },
			{
				onSuccess: () => {
					// @ts-expect-error no typesafety here
					// if the current match is the chat we are deleting, navigate to the main chat list
					if (match.id === "/chat" && match.params.id === chat.id) {
						router.navigate({ to: "/chat" });
					}

					removeChatFromQueryCache(queryClient, mainRouter, chat.id);
				},
				onError: (err) => {
					console.log("Failed to delete chat", err);
				},
			}
		);
	};

	return (
		<>
			<RenameChatDialog
				chat={chat}
				dialogProps={{
					open: isRenameDialogOpen,
					onOpenChange: (e) => setIsRenameDialogOpen(e.open),
				}}
			/>
			<Link to="/chat/$id" params={{ id: chat.id }}>
				{({ isActive }) => (
					<SidebarItem isActive={isActive}>
						{chat.name}
						<MenuRoot>
							<MenuTrigger>
								<EllipsisIcon />
							</MenuTrigger>
							<MenuPositioner>
								<MenuContent>
									<MenuItem
										value="rename"
										onClick={() => setIsRenameDialogOpen(true)}
									>
										<PencilIcon />
										Rename
									</MenuItem>
									<MenuItem value="delete" onClick={handleDelete}>
										<Trash2Icon />
										Delete
									</MenuItem>
								</MenuContent>
							</MenuPositioner>
						</MenuRoot>
					</SidebarItem>
				)}
			</Link>
		</>
	);
};

export const ChatSidebar = () => {
	const mainRouter = useMainRouter();
	const listChatsQuery = useSuspenseQuery(mainRouter.chats.list.queryOptions());

	return (
		<Sidebar className="chat-sidebar">
			<div className="chat-sidebar-actions">
				<Link
					to="/chat"
					className={iconButtonVariants({
						color: "secondary",
						variant: "ghost",
					})}
				>
					<MessageCirclePlusIcon />
				</Link>
			</div>
			<div className="chat-sidebar-main">
				<SidebarGroup>
					<SidebarGroupTitle>All time</SidebarGroupTitle>
					<SidebarGroupContent>
						{listChatsQuery.data.map((chat) => (
							<ChatItem chat={chat} key={chat.id} />
						))}
					</SidebarGroupContent>
				</SidebarGroup>
			</div>
		</Sidebar>
	);
};
