import { WIDGET_SCRIPT } from '../scriptSource';

export const URL_PLACEHOLDER = '__LIFEOS_SUMMARY_URL__';

/** The Scriptable widget script with this project's widget-summary URL filled in. */
export function widgetScript(projectUrl: string): string {
  return WIDGET_SCRIPT.replace(URL_PLACEHOLDER, `${projectUrl}/functions/v1/widget-summary`);
}
