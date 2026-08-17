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
} from './MailingsDialogs';

export function DialogManager() {
  const { dialogs } = useUIStore();
  return (
    <>
      {dialogs.insertImage    && <InsertImageDialog />}
      {dialogs.insertTable    && <InsertTableDialog />}
      {dialogs.insertLink     && <InsertLinkDialog />}
      {dialogs.insertVideo    && <InsertVideoDialog />}
      {dialogs.insert3DModel  && <Insert3DModelDialog />}
      {dialogs.insertChart    && <InsertChartDialog />}
      {dialogs.screenshot     && <ScreenshotDialog />}
      {dialogs.importDocx     && <ImportDocxDialog />}
      {dialogs.insertShape    && <InsertShapeDialog />}
      {dialogs.insertSymbol   && <InsertSymbolDialog />}
      {dialogs.findReplace    && <FindReplaceDialog />}
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
    </>
  );
}
