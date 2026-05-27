import { Button } from '@/components/ui/button';
import { Input, RedditActionButton } from '../common';
import { RedditApproveIcon, RedditRemoveIcon } from '../reddit-icons';

type BulkReviewAction = 'approve' | 'remove';

export const BulkCommentReviewToolbar = ({
  actionLocked,
  actionLockReason,
  allSelected,
  approveAction,
  bulkRemoveOpen,
  busyAction,
  canApproveComments,
  canRemoveComments,
  onClearSelection,
  onReasonChange,
  onRunReview,
  onToggleAll,
  onUpdateBulkRemoveOpen,
  reason,
  removeAction,
  selectedCount,
}: {
  actionLocked: boolean;
  actionLockReason: string;
  allSelected: boolean;
  approveAction: string;
  bulkRemoveOpen: boolean;
  busyAction: string | undefined;
  canApproveComments: boolean;
  canRemoveComments: boolean;
  onClearSelection: () => void;
  onReasonChange: (reason: string) => void;
  onRunReview: (action: BulkReviewAction) => void;
  onToggleAll: () => void;
  onUpdateBulkRemoveOpen: (removeOpen: boolean) => void;
  reason: string;
  removeAction: string;
  selectedCount: number;
}) => (
  <div className="border-b border-border bg-muted/25 px-3 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" onClick={onToggleAll}>
        {allSelected ? 'Clear selection' : 'Select all'}
      </Button>
      <span className="text-xs font-semibold leading-5 text-muted-foreground">
        {selectedCount > 0
          ? `${selectedCount} selected`
          : 'Select comments to review together'}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {selectedCount > 0 && !allSelected ? (
          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            Clear
          </Button>
        ) : null}
        {canApproveComments ? (
          <RedditActionButton
            action={approveAction}
            busyAction={busyAction}
            disabled={actionLocked || selectedCount === 0}
            icon={<RedditApproveIcon data-icon="inline-start" />}
            label="Approve selected"
            title={actionLocked ? actionLockReason : undefined}
            variant="secondary"
            onClick={() => onRunReview('approve')}
          />
        ) : null}
        {canRemoveComments ? (
          <Button
            disabled={Boolean(busyAction) || actionLocked || selectedCount === 0}
            size="sm"
            title={actionLocked ? actionLockReason : undefined}
            variant={bulkRemoveOpen ? 'destructive' : 'secondary'}
            onClick={() => onUpdateBulkRemoveOpen(true)}
          >
            <RedditRemoveIcon data-icon="inline-start" />
            Remove selected
          </Button>
        ) : null}
      </div>
    </div>
    {bulkRemoveOpen && selectedCount > 0 ? (
      <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-background p-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Removal reason for selected comments"
          className="sm:flex-1"
          disabled={actionLocked}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
        <RedditActionButton
          action={removeAction}
          busyAction={busyAction}
          disabled={actionLocked || selectedCount === 0}
          icon={<RedditRemoveIcon data-icon="inline-start" />}
          label={`Confirm remove ${selectedCount}`}
          title={actionLocked ? actionLockReason : undefined}
          variant="destructive"
          onClick={() => onRunReview('remove')}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onUpdateBulkRemoveOpen(false)}
        >
          Cancel
        </Button>
      </div>
    ) : null}
  </div>
);
