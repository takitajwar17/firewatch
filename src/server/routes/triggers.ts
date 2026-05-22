import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type {
  OnAppInstallRequest,
  OnAutomoderatorFilterCommentRequest,
  OnAutomoderatorFilterPostRequest,
  OnCommentCreateRequest,
  OnCommentDeleteRequest,
  OnCommentReportRequest,
  OnModActionRequest,
  OnPostCreateRequest,
  OnPostDeleteRequest,
  OnPostReportRequest,
  OnPostUpdateRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import {
  deleteStoredCommentContent,
  deleteStoredPostContent,
  getConfig,
  getOrCreateFirewatchBoardPost,
  upsertIncidentSignal,
} from '../core/firewatch';

export const triggers = new Hono();

const getPostBody = (post: { title?: string; selftext?: string; url?: string }) =>
  [post.title, post.selftext, post.url].filter(Boolean).join('\n');

const getFilterMatches = async (text: string) => {
  const config = await getConfig();
  const lowered = text.toLowerCase();
  const keywords = config.keywords.filter((keyword) =>
    lowered.includes(keyword.toLowerCase())
  );
  const domains = config.suspiciousDomains.filter((domain) =>
    lowered.includes(domain.toLowerCase())
  );

  return { domains, keywords };
};

const upsertPostContentSignal = async (
  type: 'post_create' | 'post_update',
  post: OnPostCreateRequest['post'],
  authorName?: string
) => {
  if (!post?.id) return;

  const body = getPostBody(post);
  const matches = await getFilterMatches(body);
  if (matches.keywords.length === 0 && matches.domains.length === 0) return;

  await upsertIncidentSignal({
    type,
    source: 'user',
    postId: post.id,
    author: authorName,
    body,
    permalink: post.permalink,
    reason: [
      matches.keywords.length
        ? `watched words: ${matches.keywords.slice(0, 5).join(', ')}`
        : undefined,
      matches.domains.length
        ? `watched domains: ${matches.domains.slice(0, 5).join(', ')}`
        : undefined,
    ]
      .filter(Boolean)
      .join('; '),
    createdAt: post.createdAt ? post.createdAt * 1000 : undefined,
    metadata: {
      matchedKeywords: matches.keywords.length,
      matchedDomains: matches.domains.length,
    },
  });
};

triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Firewatch queue created with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating Firewatch queue: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Could not create Firewatch queue',
      },
      400
    );
  }
});

triggers.post('/on-comment-create', async (c) => {
  const input = await c.req.json<OnCommentCreateRequest>();
  const comment = input.comment;
  const post = input.post;
  const postId = comment?.postId ?? post?.id;

  if (postId) {
    await upsertIncidentSignal({
      type: 'comment_create',
      postId,
      commentId: comment?.id,
      author: input.author?.name ?? comment?.author,
      body: comment?.body,
      parentId: comment?.parentId,
      permalink: comment?.permalink,
      createdAt: comment?.createdAt ? comment.createdAt * 1000 : undefined,
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-post-create', async (c) => {
  const input = await c.req.json<OnPostCreateRequest>();
  await upsertPostContentSignal('post_create', input.post, input.author?.name);

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-post-update', async (c) => {
  const input = await c.req.json<OnPostUpdateRequest>();
  await upsertPostContentSignal('post_update', input.post, input.author?.name);

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-automod-filter-comment', async (c) => {
  const input = await c.req.json<OnAutomoderatorFilterCommentRequest>();
  const comment = input.comment;

  if (comment?.postId) {
    await upsertIncidentSignal({
      type: 'automod_filter',
      source: 'mod_action',
      postId: comment.postId,
      commentId: comment.id,
      author: input.author || comment.author,
      body: comment.body,
      parentId: comment.parentId,
      reason: input.reason,
      permalink: comment.permalink,
      createdAt: input.removedAt ? new Date(input.removedAt).getTime() : Date.now(),
      metadata: {
        action: 'automod_filter_comment',
      },
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-comment-report', async (c) => {
  const input = await c.req.json<OnCommentReportRequest>();
  const comment = input.comment;

  if (comment?.postId) {
    await upsertIncidentSignal({
      type: 'comment_report',
      source: 'report',
      postId: comment.postId,
      commentId: comment.id,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      reason: input.reason,
      permalink: comment.permalink,
      createdAt: Date.now(),
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-comment-delete', async (c) => {
  const input = await c.req.json<OnCommentDeleteRequest>();

  if (input.postId && input.commentId) {
    await deleteStoredCommentContent(input.postId, input.commentId);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-automod-filter-post', async (c) => {
  const input = await c.req.json<OnAutomoderatorFilterPostRequest>();
  const post = input.post;

  if (post?.id) {
    await upsertIncidentSignal({
      type: 'automod_filter',
      source: 'mod_action',
      postId: post.id,
      body: `${post.title}\n${post.selftext}`,
      reason: input.reason,
      permalink: post.permalink,
      createdAt: input.removedAt ? new Date(input.removedAt).getTime() : Date.now(),
      metadata: {
        action: 'automod_filter_post',
      },
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-post-report', async (c) => {
  const input = await c.req.json<OnPostReportRequest>();
  const post = input.post;

  if (post?.id) {
    await upsertIncidentSignal({
      type: 'post_report',
      source: 'report',
      postId: post.id,
      body: `${post.title}\n${post.selftext}`,
      reason: input.reason,
      createdAt: Date.now(),
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-post-delete', async (c) => {
  const input = await c.req.json<OnPostDeleteRequest>();

  if (input.postId) {
    await deleteStoredPostContent(input.postId);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-mod-action', async (c) => {
  const input = await c.req.json<OnModActionRequest>();
  const action = input.action?.toLowerCase();
  const moderatorName = input.moderator?.name;

  if (!action || moderatorName === context.appSlug) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  if (
    (action === 'removecomment' || action === 'spamcomment') &&
    input.targetComment?.postId
  ) {
    await upsertIncidentSignal({
      type: 'mod_action',
      source: 'mod_action',
      postId: input.targetComment.postId,
      commentId: input.targetComment.id,
      parentId: input.targetComment.parentId,
      reason: `Comment removed by u/${moderatorName ?? 'mod'}`,
      createdAt: input.actionedAt
        ? new Date(input.actionedAt).getTime()
        : Date.now(),
      metadata: {
        action,
      },
    });
  }

  if (
    (action === 'removelink' ||
      action === 'spamlink' ||
      action === 'lock' ||
      action === 'sticky') &&
    input.targetPost?.id
  ) {
    await upsertIncidentSignal({
      type: 'mod_action',
      source: 'mod_action',
      postId: input.targetPost.id,
      reason: `Post ${action} by u/${moderatorName ?? 'mod'}`,
      createdAt: input.actionedAt
        ? new Date(input.actionedAt).getTime()
        : Date.now(),
      metadata: {
        action,
      },
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
