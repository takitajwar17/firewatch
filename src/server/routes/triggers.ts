import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
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
  recordExternalModAction,
  upsertIncidentSignal,
} from '../core/firewatch';
import {
  watchedDomainMatches,
  watchedWordMatches,
} from '../core/firewatch-detection';
import {
  COMMENT_MOD_ACTIONS,
  POST_MOD_ACTIONS,
  modActionSignalReason,
} from '../core/mod-actions';
import { logFirewatchError } from '../core/firewatch/logging';

/**
 * Devvit lifecycle and Reddit event trigger endpoints. Each handler returns
 * success to Reddit after logging failures so transient trigger errors do not
 * cause repeated platform retries for the same event.
 */
export const triggers = new Hono();

const getPostBody = (post: {
  title?: string;
  selftext?: string;
  url?: string;
}) => [post.title, post.selftext, post.url].filter(Boolean).join('\n');

const getFilterMatches = async (text: string) => {
  const config = await getConfig();
  const keywords = watchedWordMatches(text, config.keywords).map(
    (match) => match.term
  );
  const domains = watchedDomainMatches(text, config.suspiciousDomains).map(
    (match) => match.term
  );

  return { domains, keywords };
};

const eventTimestamp = (value?: string) => {
  if (!value) return Date.now();

  const parsed = Date.parse(value);
  const currentTime = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > currentTime + fiveMinutes
  ) {
    return currentTime;
  }

  return parsed;
};

const redditCreatedAt = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value * 1000
    : undefined;

const okTrigger = (c: HonoContext) => c.json<TriggerResponse>({ status: 'ok' });

const triggerErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown trigger failure';

const runTrigger = async (
  c: HonoContext,
  label: string,
  handler: () => Promise<TriggerResponse | void>
) => {
  try {
    const result = await handler();
    return result ? c.json<TriggerResponse>(result, 200) : okTrigger(c);
  } catch (error) {
    logFirewatchError('trigger.failed', {
      label,
      subredditName: context.subredditName,
      error,
    });
    return c.json<TriggerResponse>(
      {
        status: 'ok',
        message: `${label} failed: ${triggerErrorMessage(error)}`,
      },
      200
    );
  }
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
    createdAt: redditCreatedAt(post.createdAt),
    metadata: {
      matchedKeywords: matches.keywords.length,
      matchedDomains: matches.domains.length,
    },
  });
};

triggers.post('/on-app-install', async (c) => {
  return runTrigger(c, 'app install', async () => {
    const input = await c.req.json<OnAppInstallRequest>();
    const post = await getOrCreateFirewatchBoardPost();

    return {
      status: 'success',
      message: `Firewatch review post created with id ${post.id} (trigger: ${input.type})`,
    };
  });
});

triggers.post('/on-comment-create', async (c) => {
  return runTrigger(c, 'comment create', async () => {
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
        createdAt: redditCreatedAt(comment?.createdAt),
      });
    }
  });
});

triggers.post('/on-post-create', async (c) => {
  return runTrigger(c, 'post create', async () => {
    const input = await c.req.json<OnPostCreateRequest>();
    await upsertPostContentSignal('post_create', input.post, input.author?.name);
  });
});

triggers.post('/on-post-update', async (c) => {
  return runTrigger(c, 'post update', async () => {
    const input = await c.req.json<OnPostUpdateRequest>();
    await upsertPostContentSignal('post_update', input.post, input.author?.name);
  });
});

triggers.post('/on-automod-filter-comment', async (c) => {
  return runTrigger(c, 'automod filter comment', async () => {
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
        createdAt: eventTimestamp(input.removedAt),
        metadata: {
          action: 'automod_filter_comment',
        },
      });
    }
  });
});

triggers.post('/on-comment-report', async (c) => {
  return runTrigger(c, 'comment report', async () => {
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
        createdAt: eventTimestamp(),
      });
    }
  });
});

triggers.post('/on-comment-delete', async (c) => {
  return runTrigger(c, 'comment delete', async () => {
    const input = await c.req.json<OnCommentDeleteRequest>();

    if (input.postId && input.commentId) {
      await deleteStoredCommentContent(input.postId, input.commentId);
    }
  });
});

triggers.post('/on-automod-filter-post', async (c) => {
  return runTrigger(c, 'automod filter post', async () => {
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
        createdAt: eventTimestamp(input.removedAt),
        metadata: {
          action: 'automod_filter_post',
        },
      });
    }
  });
});

triggers.post('/on-post-report', async (c) => {
  return runTrigger(c, 'post report', async () => {
    const input = await c.req.json<OnPostReportRequest>();
    const post = input.post;

    if (post?.id) {
      await upsertIncidentSignal({
        type: 'post_report',
        source: 'report',
        postId: post.id,
        body: `${post.title}\n${post.selftext}`,
        reason: input.reason,
        createdAt: eventTimestamp(),
      });
    }
  });
});

triggers.post('/on-post-delete', async (c) => {
  return runTrigger(c, 'post delete', async () => {
    const input = await c.req.json<OnPostDeleteRequest>();

    if (input.postId) {
      await deleteStoredPostContent(input.postId);
    }
  });
});

triggers.post('/on-mod-action', async (c) => {
  return runTrigger(c, 'mod action', async () => {
    const input = await c.req.json<OnModActionRequest>();
    const action = input.action?.toLowerCase();
    const moderatorName = input.moderator?.name;

    if (!action || moderatorName === context.appSlug) {
      return;
    }

    if (COMMENT_MOD_ACTIONS.has(action) && input.targetComment?.postId) {
      await upsertIncidentSignal({
        type: 'mod_action',
        source: 'mod_action',
        postId: input.targetComment.postId,
        commentId: input.targetComment.id,
        parentId: input.targetComment.parentId,
        reason: modActionSignalReason({
          action,
          moderatorName,
          targetKind: 'comment',
        }),
        createdAt: eventTimestamp(input.actionedAt),
        metadata: {
          action,
        },
      });
      await recordExternalModAction({
        action,
        moderatorName,
        postId: input.targetComment.postId,
        targetCommentId: input.targetComment.id,
      });
    } else if (POST_MOD_ACTIONS.has(action) && input.targetPost?.id) {
      await upsertIncidentSignal({
        type: 'mod_action',
        source: 'mod_action',
        postId: input.targetPost.id,
        reason: modActionSignalReason({
          action,
          moderatorName,
          targetKind: 'post',
        }),
        createdAt: eventTimestamp(input.actionedAt),
        metadata: {
          action,
        },
      });
      await recordExternalModAction({
        action,
        moderatorName,
        postId: input.targetPost.id,
        targetPostId: input.targetPost.id,
      });
    }
  });
});
