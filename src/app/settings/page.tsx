'use client';

import DataManagement from './components/DataManagement';
import Export from './components/Export';
import KnownWordsImport from './components/KnownWordsImport';
import APITokens from './components/APITokens';
import TwoFactorSettings from './components/TwoFactorSettings';
import Timezone from './components/Timezone';
import ThemeSettings from './components/ThemeSettings';
import AnkiSettings from './components/AnkiSettings';
import TTSSettings from './components/TTSSettings';
import LLMSettings from './components/LLMSettings';
import PracticeSettings from './components/PracticeSettings';
import ProseSettings from './components/ProseSettings';
import LanguagesSettings from './components/LanguagesSettings';
import VersionInfo from './components/VersionInfo';
import DeleteAccount from './components/DeleteAccount';
import PageHeader from '@/components/PageHeader';
import BYOKSettings from './components/BYOKSettings';
import CloudPlanSettings from './components/CloudPlanSettings';
import HighlightingSettings from './components/HighlightingSettings';
import { lectorMode } from '@/lib/api-base';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TAB_APPEARANCE = 'appearance';
const TAB_PRACTICE = 'practice';
const TAB_LANGUAGES = 'languages';
const TAB_DATA_INTEGRATION = 'data-integration';
const TAB_ACCOUNT = 'account';
const TAB_MISC = 'misc';

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Settings" />
      <Tabs defaultValue={TAB_APPEARANCE}>
        <TabsList>
          <TabsTrigger value={TAB_APPEARANCE}>Appearance</TabsTrigger>
          <TabsTrigger value={TAB_PRACTICE}>Practice</TabsTrigger>
          <TabsTrigger value={TAB_LANGUAGES}>Languages</TabsTrigger>
          <TabsTrigger value={TAB_DATA_INTEGRATION}>Data &amp; Integration</TabsTrigger>
          <TabsTrigger value={TAB_ACCOUNT}>Account</TabsTrigger>
          <TabsTrigger value={TAB_MISC}>Misc</TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_APPEARANCE}>
          <div className="space-y-8">
            <HighlightingSettings />
            <ThemeSettings />
            <ProseSettings />
          </div>
        </TabsContent>

        <TabsContent value={TAB_PRACTICE}>
          <div className="space-y-8">
            <PracticeSettings />
          </div>
        </TabsContent>

        <TabsContent value={TAB_LANGUAGES}>
          <div className="space-y-8">
            <LanguagesSettings />
          </div>
        </TabsContent>

        <TabsContent value={TAB_DATA_INTEGRATION}>
          <div className="space-y-8">
            {lectorMode() === 'cloud' && <CloudPlanSettings />}
            {lectorMode() === 'cloud' ? <BYOKSettings /> : <LLMSettings />}
            <AnkiSettings />
            <TTSSettings />
            <APITokens />
            <DataManagement />
            <VersionInfo />
          </div>
        </TabsContent>

        <TabsContent value={TAB_ACCOUNT}>
          <div className="space-y-8">
            <TwoFactorSettings />
            <DeleteAccount />
          </div>
        </TabsContent>

        <TabsContent value={TAB_MISC}>
          <div className="space-y-8">
            <KnownWordsImport />
            <Export />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
