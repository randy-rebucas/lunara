import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRiderOperations } from '../../src/context/rider-operations';
import { RiderAlertsBell } from '../../src/components/rider-alerts-bell';
import { TasksHeaderActions } from '../../src/components/tasks-header-actions';
import { TAB_BAR_CONTENT_HEIGHT } from '../../src/hooks/use-tab-bar-height';
import { colors, spacing } from '../../src/theme';

type TabIcon = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIcon) {
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

function TabsNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? spacing.sm : 0);
  const { taskBadgeCount } = useRiderOperations();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          paddingBottom: bottomInset,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
        },
        tabBarItemStyle: {
          paddingTop: spacing.xs,
        },
        headerStyle: {
          backgroundColor: colors.surfaceMuted,
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          color: colors.foreground,
        },
        headerTintColor: colors.primary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home-outline'),
          headerRight: () => <RiderAlertsBell />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: tabIcon('list-outline'),
          tabBarBadge: taskBadgeCount > 0 ? (taskBadgeCount > 9 ? '9+' : taskBadgeCount) : undefined,
          headerRight: () => <TasksHeaderActions />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-outline'),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return <TabsNavigator />;
}
