import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRiderOperations } from '../../src/context/rider-operations';
import { AppHeader } from '../../src/components/ui/app-header';
import { TAB_BAR_CONTENT_HEIGHT } from '../../src/hooks/use-tab-bar-height';
import { colors, radius, spacing } from '../../src/theme';

type TabIcon = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIcon) {
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

/** Raised circular button, always in the primary color, so the scan action reads as a distinct
 * "do a thing" affordance rather than one more destination alongside Home/Tasks/etc. */
function scanTabIcon({ focused }: { focused: boolean; color: ColorValue; size: number }) {
  return (
    <View style={[fabStyles.circle, focused && fabStyles.circleFocused]}>
      <Ionicons name="qr-code" size={22} color={colors.onPrimary} />
    </View>
  );
}

const fabStyles = StyleSheet.create({
  circle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  circleFocused: {
    backgroundColor: colors.primaryDark,
  },
});

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
        header: () => <AppHeader />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: tabIcon('list-outline'),
          tabBarBadge: taskBadgeCount > 0 ? (taskBadgeCount > 9 ? '9+' : taskBadgeCount) : undefined,
        }}
      />
      <Tabs.Screen
        name="scan-tag"
        options={{
          title: 'Scan',
          tabBarIcon: scanTabIcon,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: tabIcon('time-outline'),
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
