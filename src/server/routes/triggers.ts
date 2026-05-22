import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentCreateRequest,
  OnCommentReportRequest,
  OnPostReportRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { createFirewatchPost, upsertIncidentSignal } from '../core/firewatch';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    const post = await createFirewatchPost();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Firewatch board created with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating Firewatch board: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create Firewatch board',
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
      author: comment?.author ?? input.author?.name,
      body: comment?.body,
      parentId: comment?.parentId,
      permalink: comment?.permalink,
      createdAt: comment?.createdAt ? comment.createdAt * 1000 : undefined,
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

triggers.post('/on-post-report', async (c) => {
  const input = await c.req.json<OnPostReportRequest>();
  const post = input.post;

  if (post?.id) {
    await upsertIncidentSignal({
      type: 'post_report',
      postId: post.id,
      body: `${post.title}\n${post.selftext}`,
      reason: input.reason,
      createdAt: Date.now(),
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
