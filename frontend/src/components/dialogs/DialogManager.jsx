import { useUIStore } from '@/store';
import { InsertImageDialog }   from './InsertImageDialog';
import { InsertTableDialog }   from './InsertTableDialog';
import { InsertLinkDialog }    from './InsertLinkDialog';
import { InsertChartDialog }   from './InsertChartDialog';
import { InsertShapeDialog }   from './InsertShapeDialog';
import { InsertSymbolDialog }  from './InsertSymbolDialog';
import { InsertVideoDialog }   from './InsertVideoDialog';
import { Insert3DModelDialog } from './Insert3DModelDialog';
import { ScreenshotDialog }    from './ScreenshotDialog';
import { ImportDocxDialog }    from './ImportDocxDialog';
import { FindReplaceDialog }   from './FindReplaceDialog';
import { GoToDialog }          from './GoToDialog';
import { ExportDialog }        from './ExportDialog';
import { ShareDialog }         from './ShareDialog';
import { VersionHistoryDialog} from './VersionHistoryDialog';
import { DrawingDialog }       from './DrawingDialog';
import { HeaderFooterDialog }  from './HeaderFooterDialog';
import { WordArtDialog }       from './WordArtDialog';
import { EquationDialog }      from './EquationDialog';
import { CommandMapDialog }    from './CommandMapDialog';
import { HelpDialog }          from './HelpDialog';
import { WhatsNewDialog }      from './WhatsNewDialog';
import { PragnaAiDialog }      from './PragnaAiDialog';
import {
  WordCountDialog,
  CommentsDialog,
  AccessibilityDialog,
  LanguageDialog,
  ReviewingPaneDialog,
  CompareDocumentsDialog,
  RestrictEditingDialog,
} from './ReviewDialogs';
import {
  TableOfContentsDialog,
  InsertCitationDialog,
  ManageSourcesDialog,
  BibliographyDialog,
  TableOfFiguresDialog,
  TableOfTablesDialog,
  IndexDialog,
} from './ReferenceDialogs';
import {
  MailMergeDialog,
  SelectRecipientsDialog,
  EditRecipientsDialog,
  InsertMergeFieldDialog,
  GreetingLineDialog,
  EnvelopesDialog,
  LabelsDialog,
  PreviewMergeDialog,
  MatchFieldsDialog,
  MergeRulesDialog,
  FindRecipientDialog,
} from './MailingsDialogs';

import { SecurityDialog }       from './SecurityDialog';
import { DigitalSignatureDialog } from './DigitalSignatureDialog';
import { ReadabilityDialog }    from './ReadabilityDialog';
import { BuildingBlocksDialog } from './BuildingBlocksDialog';
import { ShortcutRemapDialog }  from './ShortcutRemapDialog';
import { MergeConflictDialog }  from './MergeConflictDialog';
import { MasterDocumentDialog } from './MasterDocumentDialog';
import { StyleInspectorDialog } from './StyleInspectorDialog';
import { ClipboardHistoryDrawer } from './ClipboardHistoryDrawer';
import { CitationFactCheckDialog } from './CitationFactCheckDialog';
import { HandwritingDialog } from './HandwritingDialog';
import { PageSetupDialog } from './PageSetupDialog';
import { MacrosDialog } from './MacrosDialog';
import { ZoomDialog } from './ZoomDialog';
import { InsertIconsDialog } from './InsertIconsDialog';
import { ImmersiveReader } from './ImmersiveReader';
import { InsertSmartArtDialog } from './InsertSmartArtDialog';
import { InsertObjectDialog } from './InsertObjectDialog';
import { MobileAppDialog } from './MobileAppDialog';
import { WindowDocumentsDialog } from './WindowDocumentsDialog';
import { ArrangeWindowsDialog } from './ArrangeWindowsDialog';
import { Modal } from '@/components/ui';
import { BookmarkDialog, CrossReferenceDialog, CoverPageDialog } from './DocumentStructureDialogs';

export function DialogManager() {
  const { dialogs, closeDialog } = useUIStore();
  return (
    <>
      {dialogs.insertImage    && <InsertImageDialog />}
      {dialogs.insertTable    && <InsertTableDialog />}
      {dialogs.insertLink     && <InsertLinkDialog />}
      {dialogs.insertVideo    && <InsertVideoDialog />}
      {dialogs.insert3DModel  && <Insert3DModelDialog />}
      {dialogs.macros         && <MacrosDialog />}
      {dialogs.zoom           && <ZoomDialog />}
      {dialogs.insertIcons    && <InsertIconsDialog />}
      {dialogs.immersiveReader && <ImmersiveReader />}
      {dialogs.insertSmartArt && <InsertSmartArtDialog />}
      {dialogs.insertObject   && <InsertObjectDialog />}
      {dialogs.mobileApp      && <MobileAppDialog />}
      {dialogs.sideBySide     && <WindowDocumentsDialog mode="sideBySide" />}
      {dialogs.switchWindows  && <WindowDocumentsDialog mode="switch" />}
      {dialogs.arrangeWindows && <ArrangeWindowsDialog />}
      {dialogs.insertChart    && <InsertChartDialog />}
      {dialogs.screenshot     && <ScreenshotDialog />}
      {dialogs.importDocx     && <ImportDocxDialog />}
      {dialogs.insertShape    && <InsertShapeDialog />}
      {dialogs.insertSymbol   && <InsertSymbolDialog />}
      {dialogs.findReplace    && <FindReplaceDialog />}
      {dialogs.goTo           && <GoToDialog />}
      {dialogs.exportDoc      && <ExportDialog />}
      {dialogs.shareDoc       && <ShareDialog />}
      {dialogs.versionHistory && <VersionHistoryDialog />}
      {dialogs.drawing        && <DrawingDialog />}
      {dialogs.headerFooter   && <HeaderFooterDialog />}
      {dialogs.wordArt        && <WordArtDialog />}
      {dialogs.equation       && <EquationDialog />}
      {dialogs.commandMap     && <CommandMapDialog />}
      {dialogs.help           && <HelpDialog />}
      {dialogs.whatsNew       && <WhatsNewDialog />}
      {dialogs.wordCount      && <WordCountDialog />}
      {dialogs.comments       && <CommentsDialog />}
      {dialogs.accessibility  && <AccessibilityDialog />}
      {dialogs.language       && <LanguageDialog />}
      {dialogs.reviewingPane  && <ReviewingPaneDialog />}
      {dialogs.compareDocuments && <CompareDocumentsDialog />}
      {dialogs.restrictEditing && <RestrictEditingDialog />}
      {dialogs.tableOfContents && <TableOfContentsDialog />}
      {dialogs.tableOfFigures  && <TableOfFiguresDialog />}
      {dialogs.tableOfTables   && <TableOfTablesDialog />}
      {dialogs.insertIndex     && <IndexDialog />}
      {dialogs.insertCitation  && <InsertCitationDialog />}
      {dialogs.manageSources   && <ManageSourcesDialog />}
      {dialogs.bibliography    && <BibliographyDialog />}
      {dialogs.mailMerge       && <MailMergeDialog />}
      {dialogs.selectRecipients && <SelectRecipientsDialog />}
      {dialogs.editRecipients  && <EditRecipientsDialog />}
      {dialogs.insertMergeField && <InsertMergeFieldDialog />}
      {dialogs.greetingLine    && <GreetingLineDialog />}
      {dialogs.envelopes       && <EnvelopesDialog />}
      {dialogs.labels          && <LabelsDialog />}
      {dialogs.finishMerge     && <PreviewMergeDialog />}
      {dialogs.previewMerge    && <PreviewMergeDialog previewOnly />}
      {dialogs.updateLabels    && <LabelsDialog updateExisting />}
      {dialogs.matchFields     && <MatchFieldsDialog />}
      {dialogs.mergeRules      && <MergeRulesDialog />}
      {dialogs.findRecipient   && <FindRecipientDialog />}
      {dialogs.pragnaAi        && <PragnaAiDialog />}
      {dialogs.security       && <SecurityDialog />}
      {dialogs.digitalSignature && <DigitalSignatureDialog />}
      {dialogs.readability    && <ReadabilityDialog />}
      {dialogs.buildingBlocks && <BuildingBlocksDialog />}
      {dialogs.shortcuts      && <ShortcutRemapDialog />}
      {dialogs.mergeConflict  && <MergeConflictDialog />}
      {dialogs.masterDoc      && <MasterDocumentDialog />}
      {dialogs.styleInspector && <StyleInspectorDialog />}
      {dialogs.clipboardHistory && <ClipboardHistoryDrawer />}
      {dialogs.citationFactCheck && <CitationFactCheckDialog />}
      {dialogs.handwriting    && <HandwritingDialog />}
      {dialogs.pageSetup && <PageSetupDialog />}
      {dialogs.bookmark && <BookmarkDialog />}
      {dialogs.crossReference && <CrossReferenceDialog />}
      {dialogs.templates && <CoverPageDialog />}
      {dialogs.about && <Modal title="About EtherX Word" onClose={() => closeDialog('about')}>
        <p>A document studio with rich text editing, page design, export, collaboration, and Pragna writing tools.</p>
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>EtherX Word · Version 1.0</p>
      </Modal>}
    </>
  );
}
