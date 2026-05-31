import { StyleSheet, Text, View } from 'react-native';
import { Button } from './ui/button';
import { Card } from './ui/card';
import type { RiderTaskDetailsFields } from '../lib/rider-task-types';
import { colors, spacing, typography } from '../theme';

type TaskType = 'pickup' | 'delivery';

interface TaskDetailsCardProps {
  task: RiderTaskDetailsFields;
  taskType: TaskType;
  showActions?: boolean;
  loading?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onNavigateCustomer?: () => void;
  onNavigateShop?: () => void;
  onCallCustomer?: () => void;
  onCallShop?: () => void;
}

function formatAddress(addr: { line1: string; line2?: string; city: string; province?: string }) {
  return [addr.line1, addr.line2, addr.city, addr.province].filter(Boolean).join(', ');
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function TaskDetailsCard({
  task,
  taskType,
  showActions = false,
  loading = false,
  onAccept,
  onReject,
  onNavigateCustomer,
  onNavigateShop,
  onCallCustomer,
  onCallShop,
}: TaskDetailsCardProps) {
  const customerAddress = task.customerAddress;
  const shop = task.shopLocation;
  const customerPhoneDisplay = task.customerPhone ?? task.customerPhoneMasked;
  const shopPhoneDisplay = task.shopPhone ?? task.shopPhoneMasked;
  const navigateCustomerLabel =
    taskType === 'pickup' ? 'Navigate to customer' : 'Navigate to customer';
  const navigateShopLabel =
    taskType === 'pickup' ? 'Navigate to shop' : 'Navigate to shop';

  return (
    <>
      <Card elevated style={styles.card}>
        <Text style={styles.sectionTitle}>Customer information</Text>
        <DetailRow label="Name" value={task.customerName ?? customerAddress?.label} />
        <DetailRow label="Mobile" value={customerPhoneDisplay} />
        {customerAddress ? (
          <DetailRow label="Address" value={formatAddress(customerAddress)} />
        ) : null}
      </Card>

      <Card elevated style={styles.card}>
        <Text style={styles.sectionTitle}>Shop information</Text>
        <DetailRow label="Shop" value={task.shopName ?? task.branchName} />
        <DetailRow label="Branch" value={task.branchCode ?? task.branchName} />
        {shop ? <DetailRow label="Address" value={formatAddress(shop)} /> : null}
      </Card>

      <Card elevated style={styles.card}>
        <Text style={styles.sectionTitle}>Order information</Text>
        <DetailRow label="Order number" value={task.orderNumber ?? undefined} />
        <DetailRow
          label="Service type"
          value={task.bookingType.replace(/_/g, ' ')}
        />
        <DetailRow
          label="Estimated weight"
          value={
            task.estimatedWeightKg != null ? `${task.estimatedWeightKg} kg` : undefined
          }
        />
        <DetailRow label="Special instructions" value={task.specialInstructions} />
      </Card>

      {showActions ? (
        <View style={styles.actions}>
          {onAccept ? (
            <Button label="Accept task" disabled={loading} onPress={onAccept} style={styles.action} />
          ) : null}
          {onReject && task.canReject !== false ? (
            <Button
              label="Reject task"
              variant="outline"
              disabled={loading}
              onPress={onReject}
              style={styles.action}
            />
          ) : null}
          {onNavigateCustomer ? (
            <Button
              label={navigateCustomerLabel}
              variant="secondary"
              disabled={loading}
              onPress={onNavigateCustomer}
              style={styles.action}
            />
          ) : null}
          {onNavigateShop ? (
            <Button
              label={navigateShopLabel}
              variant="secondary"
              disabled={loading}
              onPress={onNavigateShop}
              style={styles.action}
            />
          ) : null}
          {onCallCustomer ? (
            <Button
              label="Call customer"
              variant="outline"
              disabled={loading || !task.customerPhone}
              onPress={onCallCustomer}
              style={styles.action}
            />
          ) : null}
          {onCallShop ? (
            <Button
              label="Call shop"
              variant="outline"
              disabled={loading || !task.shopPhone}
              onPress={onCallShop}
              style={styles.action}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg },
  sectionTitle: { ...typography.subheading, fontSize: 16, marginBottom: spacing.sm },
  row: { marginTop: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.mutedForeground, textTransform: 'uppercase' },
  rowValue: { marginTop: 2, ...typography.bodySm, color: colors.foreground },
  actions: { marginTop: spacing.md },
  action: { marginTop: spacing.md },
});
