import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SubscriptionModal } from './components/SubscriptionModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ExportImportModal } from './components/ExportImportModal';

import { DashboardPage } from './pages/DashboardPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { CalendarPage } from './pages/CalendarPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';

import { Subscription, AnalyticsSummary } from './types';
import { api } from './lib/api';

export const App: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [deletingSub, setDeletingSub] = useState<Subscription | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

  // Load subscriptions & analytics
  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [subsRes, analyticsRes] = await Promise.all([
        api.subscriptions.list(),
        api.analytics.getSummary(),
      ]);
      if (subsRes.success) setSubscriptions(subsRes.data);
      if (analyticsRes.success) setAnalytics(analyticsRes.data);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      toast({
        type: 'error',
        message: 'Could not fetch data',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcut "/" to search
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setCurrentTab('subscriptions');
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      // Escape closes open modals
      if (e.key === 'Escape') {
        setIsSubModalOpen(false);
        setEditingSub(null);
        setDeletingSub(null);
        setIsExportImportOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500">Loading SubTrack...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Handlers
  const handleOpenAdd = () => {
    setEditingSub(null);
    setIsSubModalOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setIsSubModalOpen(true);
  };

  const handleSaveSubscription = async (formData: Partial<Subscription>) => {
    if (editingSub) {
      const res = await api.subscriptions.update(editingSub.id, formData);
      toast({
        type: 'success',
        message: 'Subscription updated',
        description: `${res.data.name} details have been saved.`,
      });
    } else {
      const res = await api.subscriptions.create(formData);
      toast({
        type: 'success',
        message: 'Subscription added',
        description: `${res.data.name} is now tracked.`,
      });
    }
    await refreshData();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSub) return;
    try {
      setDeleteLoading(true);
      await api.subscriptions.delete(deletingSub.id);
      toast({
        type: 'success',
        message: 'Subscription deleted',
        description: `${deletingSub.name} was removed from tracking.`,
      });
      setDeletingSub(null);
      await refreshData();
    } catch (err: any) {
      toast({
        type: 'error',
        message: 'Failed to delete subscription',
        description: err.message,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRenewSubscription = async (id: string) => {
    try {
      const res = await api.subscriptions.renew(id);
      toast({
        type: 'success',
        message: 'Subscription Renewed! 🎉',
        description: res.message,
      });
      await refreshData();
    } catch (err: any) {
      toast({
        type: 'error',
        message: 'Failed to renew subscription',
        description: err.message,
      });
    }
  };

  const handleToggleStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.subscriptions.toggleStatus(id, newStatus);
      toast({
        type: 'info',
        message: 'Status updated',
        description: res.message,
      });
      await refreshData();
    } catch (err: any) {
      toast({
        type: 'error',
        message: 'Failed to update status',
        description: err.message,
      });
    }
  };

  const handleImportSubscriptions = async (items: Partial<Subscription>[]) => {
    const res = await api.subscriptions.import(items);
    toast({
      type: 'success',
      message: 'Bulk Import Complete!',
      description: res.message,
    });
    await refreshData();
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim() && currentTab !== 'subscriptions') {
      setCurrentTab('subscriptions');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <Header
        onOpenAddModal={handleOpenAdd}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        upcomingRenewals={analytics?.upcoming_renewals}
        onRenewSubscription={handleRenewSubscription}
        onNavigate={setCurrentTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-16 md:pb-0">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          renewalsDueCount={analytics?.renewals_next_7_days.count}
        />

        {/* Page Content View */}
        <main className="flex-1 overflow-x-hidden">
          {currentTab === 'dashboard' && (
            <DashboardPage
              analytics={analytics}
              loading={loading}
              onOpenAddModal={handleOpenAdd}
              onRenewSubscription={handleRenewSubscription}
              onEditSubscription={handleOpenEdit}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'subscriptions' && (
            <SubscriptionsPage
              subscriptions={subscriptions}
              loading={loading}
              userCurrency={user.currency || 'USD'}
              onOpenAddModal={handleOpenAdd}
              onEditSubscription={handleOpenEdit}
              onDeleteSubscription={setDeletingSub}
              onRenewSubscription={handleRenewSubscription}
              onToggleStatus={handleToggleStatus}
              onOpenExportImport={() => setIsExportImportOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarPage
              subscriptions={subscriptions}
              userCurrency={user.currency || 'USD'}
              onRenewSubscription={handleRenewSubscription}
              onEditSubscription={handleOpenEdit}
              onOpenAddModal={handleOpenAdd}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage
              analytics={analytics}
              loading={loading}
              onOpenExportImport={() => setIsExportImportOpen(true)}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              onOpenExportImport={() => setIsExportImportOpen(true)}
              onDataReset={refreshData}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => {
          setIsSubModalOpen(false);
          setEditingSub(null);
        }}
        onSubmit={handleSaveSubscription}
        initialData={editingSub}
        userCurrency={user.currency || 'USD'}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingSub)}
        subscriptionName={deletingSub?.name || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingSub(null)}
        loading={deleteLoading}
      />

      <ExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        subscriptions={subscriptions}
        onImport={handleImportSubscriptions}
      />
    </div>
  );
};
