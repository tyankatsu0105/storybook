import React, { FunctionComponent, MouseEvent, useCallback, useState } from 'react';
import { logger } from '@storybook/client-logger';
import { styled } from '@storybook/theming';
import global from 'global';
import memoize from 'memoizerific';

// @ts-ignore
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
// @ts-ignore
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
// @ts-ignore
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
// @ts-ignore
import jsExtras from 'react-syntax-highlighter/dist/esm/languages/prism/js-extras';
// @ts-ignore
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
// @ts-ignore
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
// @ts-ignore
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
// @ts-ignore
import md from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
// @ts-ignore
import yml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
// @ts-ignore
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
// @ts-ignore
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';

// @ts-ignore
import ReactSyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
// @ts-ignore
import { createElement } from 'react-syntax-highlighter/dist/esm/index';

import { ActionBar } from '../ActionBar/ActionBar';
import { ScrollArea } from '../ScrollArea/ScrollArea';

import type { SyntaxHighlighterProps } from './syntaxhighlighter-types';

const { navigator, document, window: globalWindow } = global;

ReactSyntaxHighlighter.registerLanguage('jsextra', jsExtras);
ReactSyntaxHighlighter.registerLanguage('jsx', jsx);
ReactSyntaxHighlighter.registerLanguage('json', json);
ReactSyntaxHighlighter.registerLanguage('yml', yml);
ReactSyntaxHighlighter.registerLanguage('md', md);
ReactSyntaxHighlighter.registerLanguage('bash', bash);
ReactSyntaxHighlighter.registerLanguage('css', css);
ReactSyntaxHighlighter.registerLanguage('html', html);
ReactSyntaxHighlighter.registerLanguage('tsx', tsx);
ReactSyntaxHighlighter.registerLanguage('typescript', typescript);
ReactSyntaxHighlighter.registerLanguage('graphql', graphql);

const themedSyntax = memoize(2)((theme) =>
  Object.entries(theme.code || {}).reduce((acc, [key, val]) => ({ ...acc, [`* .${key}`]: val }), {})
);

const copyToClipboard: (text: string) => Promise<void> = createCopyToClipboardFunction();

export function createCopyToClipboardFunction() {
  if (navigator?.clipboard) {
    return (text: string) => navigator.clipboard.writeText(text);
  }
  return async (text: string) => {
    const tmp = document.createElement('TEXTAREA');
    const focus = document.activeElement;

    tmp.value = text;

    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    focus.focus();
  };
}

export interface WrapperProps {
  bordered?: boolean;
  padded?: boolean;
  showLineNumbers?: boolean;
}

const Wrapper = styled.div<WrapperProps>(
  ({ theme }) => ({
    position: 'relative',
    overflow: 'hidden',
    color: theme.color.defaultText,
  }),
  ({ theme, bordered }) =>
    bordered
      ? {
          border: `1px solid ${theme.appBorderColor}`,
          borderRadius: theme.borderRadius,
          background: theme.background.content,
        }
      : {},
  ({ showLineNumbers }) =>
    showLineNumbers
      ? {
          // use the before pseudo element to display line numbers
          '.react-syntax-highlighter-line-number::before': {
            content: 'attr(data-line-number)',
          },
        }
      : {}
);

const Scroller = styled(({ children, className }) => (
  <ScrollArea horizontal vertical className={className}>
    {children}
  </ScrollArea>
))(
  {
    position: 'relative',
  },
  ({ theme }) => themedSyntax(theme)
);

export interface PreProps {
  padded?: boolean;
}

const Pre = styled.pre<PreProps>(({ theme, padded }) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  margin: 0,
  padding: padded ? theme.layoutMargin : 0,
}));

/*
We can't use `code` since PrismJS races for it.
See https://github.com/storybookjs/storybook/issues/18090
 */
const Code = styled.div(({ theme }) => ({
  flex: 1,
  paddingLeft: 2, // TODO: To match theming/global.ts for now
  paddingRight: theme.layoutMargin,
  opacity: 1,
}));

/**
 * A custom renderer used to process `span.linenumber` element in each line of code,
 * which should only be enabled if `showLineNumbers = true`
 */
const renderer = ({
  rows,
  stylesheet,
  useInlineStyles,
}: {
  rows: any[];
  stylesheet: any;
  useInlineStyles: any;
}) => {
  return rows.map((node: any, i: number) => {
    const children = [...node.children];
    const lineNumberNode = children[0];
    const lineNumber = lineNumberNode.children[0].value;
    const processedLineNumberNode = {
      ...lineNumberNode,
      // empty the line-number element
      children: [],
      properties: {
        ...lineNumberNode.properties,
        // add a data-line-number attribute to line-number element, so we can access the line number with `content: attr(data-line-number)`
        'data-line-number': lineNumber,
        // remove the 'userSelect: none' style, which will produce extra empty lines when copy-pasting in firefox
        style: { ...lineNumberNode.properties.style, userSelect: 'auto' },
      },
    };
    children[0] = processedLineNumberNode;
    return createElement({
      node: { ...node, children },
      stylesheet,
      useInlineStyles,
      key: `code-segement${i}`,
    });
  });
};

export interface SyntaxHighlighterState {
  copied: boolean;
}

// copied from @types/react-syntax-highlighter/index.d.ts

export const SyntaxHighlighter: FunctionComponent<SyntaxHighlighterProps> = ({
  children,
  language = 'jsx',
  copyable = false,
  bordered = false,
  padded = false,
  format = true,
  formatter = null,
  className = null,
  showLineNumbers = false,
  ...rest
}) => {
  if (typeof children !== 'string' || !children.trim()) {
    return null;
  }

  const highlightableCode = formatter ? formatter(format, children) : children.trim();
  const [copied, setCopied] = useState(false);

  const onClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    copyToClipboard(highlightableCode)
      .then(() => {
        setCopied(true);
        globalWindow.setTimeout(() => setCopied(false), 1500);
      })
      .catch(logger.error);
  }, []);

  return (
    <Wrapper
      bordered={bordered}
      padded={padded}
      showLineNumbers={showLineNumbers}
      className={className}
    >
      <Scroller>
        <ReactSyntaxHighlighter
          padded={padded || bordered}
          language={language}
          showLineNumbers={showLineNumbers}
          showInlineLineNumbers={showLineNumbers}
          useInlineStyles={false}
          PreTag={Pre}
          CodeTag={Code}
          renderer={showLineNumbers ? renderer : undefined}
          lineNumberContainerStyle={{}}
          {...rest}
        >
          {highlightableCode}
        </ReactSyntaxHighlighter>
      </Scroller>

      {copyable ? (
        <ActionBar actionItems={[{ title: copied ? 'Copied' : 'Copy', onClick }]} />
      ) : null}
    </Wrapper>
  );
};

export default SyntaxHighlighter;
