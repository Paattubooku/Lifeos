import { CalendarDays } from 'lucide-react-native';

import { Card, EmptyState, Screen } from '@/ui';

export default function TodayScreen() {
  return (
    <Screen title="Today">
      <Card>
        <EmptyState
          icon={CalendarDays}
          title="Your day runs here"
          body="Routine timeline, score ring and streak arrive in F05."
        />
      </Card>
    </Screen>
  );
}
