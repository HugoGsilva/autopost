import type { AppRouterClient } from "@autopost/api/routers/index";

type Out<T extends (...args: any) => any> = Awaited<ReturnType<T>>;

export type PlatformItem = Out<
	AppRouterClient["platforms"]["list"]
>["platforms"][number];
export type AccountItem = Out<AppRouterClient["accounts"]["list"]>[number];
export type PostItem = Out<AppRouterClient["posts"]["list"]>[number];
export type TargetItem = PostItem["targets"][number];
export type MediaItem = NonNullable<PostItem["media"]>;
