import { Button } from './Button';
import { useSheetClose } from './Sheet';

/** "Cancel" inside a Sheet: closes it with the exit animation. */
export function SheetCancel({
  onCancel,
  label = 'Cancel',
}: {
  onCancel: () => void;
  label?: string;
}) {
  const close = useSheetClose(onCancel);
  return (
    <Button
      variant="secondary"
      label={label}
      accessibilityLabel={label}
      onPress={close}
      fullWidth
    />
  );
}
