import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyText } from '../common';
import { UsernameHistoryTrigger } from '../username-history';
import type { Incident } from '../../../shared/api';

export const RepeatedPhrasesCard = ({ incident }: { incident: Incident }) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Repeated wording</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.repeatedPhrases.length === 0 ? (
        <EmptyText>No repeated wording yet.</EmptyText>
      ) : (
        <div className="flex flex-col">
          {incident.repeatedPhrases.map((phrase) => (
            <div
              key={phrase.phrase}
              className="min-w-0 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <p className="break-words text-sm font-semibold leading-5">
                {phrase.phrase}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 break-words text-xs leading-5 text-muted-foreground">
                <span>{phrase.count} matches</span>
                {phrase.authors.length ? (
                  <>
                    <span aria-hidden="true">·</span>
                    {phrase.authors.map((author) => (
                      <UsernameHistoryTrigger
                        key={author}
                        className="text-xs text-muted-foreground"
                        incident={incident}
                        username={author}
                      />
                    ))}
                  </>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
