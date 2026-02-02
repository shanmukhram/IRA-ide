/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $ } from '../../../../base/browser/dom.js';
import { Emitter } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Action } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IIraApprovalItem, IraApprovalsService } from './iraApprovals.js';

interface ApprovalElement {
	readonly item: IIraApprovalItem;
}

class ApprovalsDelegate implements IListVirtualDelegate<ApprovalElement> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return ApprovalsRenderer.TEMPLATE_ID;
	}
}

interface ApprovalsTemplate {
	readonly container: HTMLElement;
	readonly title: HTMLElement;
	readonly status: HTMLElement;
	readonly statusIcon: HTMLElement;
	readonly statusLabel: HTMLElement;
}

class ApprovalsRenderer implements IListRenderer<ApprovalElement, ApprovalsTemplate> {
	static readonly TEMPLATE_ID = 'iraApprovalRow';
	readonly templateId = ApprovalsRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ApprovalsTemplate {
		container.classList.add('ira-approvals-row');

		const row = append(container, $('.ira-approvals-row-inner'));
		const title = append(row, $('.ira-approvals-title'));

		const status = append(row, $('.ira-approvals-status'));
		const statusIcon = append(status, $('span.codicon.ira-approvals-status-icon'));
		const statusLabel = append(status, $('span.ira-approvals-status-label'));

		return { container, title, status, statusIcon, statusLabel };
	}

	renderElement(element: ApprovalElement, _index: number, template: ApprovalsTemplate): void {
		template.title.textContent = element.item.title;

		const icon = template.statusIcon;
		const label = template.statusLabel;

		icon.className = 'codicon ira-approvals-status-icon';

		let statusLabel = '';
		switch (element.item.status) {
			case 'pending':
				statusLabel = 'Pending';
				icon?.classList.add('codicon-clock');
				break;
			case 'approved':
				statusLabel = 'Approved';
				icon?.classList.add('codicon-check');
				break;
			case 'rejected':
				statusLabel = 'Rejected';
				icon?.classList.add('codicon-close');
				break;
		}

		label.textContent = statusLabel;

		template.container.classList.toggle('is-pending', element.item.status === 'pending');
		template.container.classList.toggle('is-approved', element.item.status === 'approved');
		template.container.classList.toggle('is-rejected', element.item.status === 'rejected');
	}

	disposeTemplate(_template: ApprovalsTemplate): void {
		// noop
	}
}

export class IraApprovalsView extends ViewPane {
	static readonly ID = 'ira.approvalsView';
	static readonly TITLE = localize2('iraApprovals', 'Approvals');

	private readonly disposables = new DisposableStore();
	private readonly _onDidChangeSelection = this._register(new Emitter<ApprovalElement | undefined>());
	readonly onDidChangeSelection = this._onDidChangeSelection.event;

	private approvalsService!: IraApprovalsService;
	private list!: WorkbenchList<ApprovalElement>;
	private showOnlyPending = true;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this.approvalsService = this._register(instantiationService.createInstance(IraApprovalsService));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		// piggyback on VS Code/SCM list styles (monaco list look)
		container.classList.add('scm-view');
		container.classList.add('ira-approvals-view');

		const toolbar = append(container, $('.ira-approvals-toolbar'));
		const actionbar = this._register(new ActionBar(toolbar));
		actionbar.domNode.classList.add('ira-approvals-actionbar');

		// Force labels visible (ActionBar in some contexts defaults to icon-only styling)
		const style = append(container, $('style'));
		style.textContent = `
			.ira-approvals-toolbar { display: flex; align-items: center; gap: 6px; }
			.ira-approvals-toolbar .action-label { display: inline !important; }
			.ira-approvals-toolbar .action-item .label { display: inline !important; }
			.ira-approvals-toolbar .action-item .codicon { margin-right: 6px; }
			.ira-approvals-toolbar .action-item { padding: 0 6px; }
			.ira-approvals-legend { opacity: 0.85; padding-left: 6px; }
			.ira-approvals-status { display: flex; align-items: center; gap: 6px; }
			.ira-approvals-status-icon { opacity: 0.9; }
			.ira-approvals-status-label { opacity: 0.9; }
		`;

		const request = new Action(
			'ira.approvals.request',
			'Request',
			ThemeIcon.asClassName(Codicon.add),
			true,
			() => this.commandService.executeCommand('ira.approvals.request')
		);

		const togglePending = new Action(
			'ira.approvals.togglePending',
			'Pending only',
			ThemeIcon.asClassName(Codicon.filter),
			true,
			() => {
				this.showOnlyPending = !this.showOnlyPending;
				this.refresh();
			}
		);

		const approve = new Action(
			'ira.approvals.approve.selected',
			'Approve',
			ThemeIcon.asClassName(Codicon.check),
			true,
			() => {
				const selected = this.getSelected();
				if (selected) {
					return this.commandService.executeCommand('ira.approvals.approve', selected.item.id);
				}
				return Promise.resolve();
			}
		);

		const reject = new Action(
			'ira.approvals.reject.selected',
			'Reject',
			ThemeIcon.asClassName(Codicon.close),
			true,
			() => {
				const selected = this.getSelected();
				if (selected) {
					return this.commandService.executeCommand('ira.approvals.reject', selected.item.id);
				}
				return Promise.resolve();
			}
		);

		const clear = new Action(
			'ira.approvals.clear',
			'Clear',
			ThemeIcon.asClassName(Codicon.trash),
			true,
			() => this.commandService.executeCommand('ira.approvals.clear')
		);

		this._register(request);
		this._register(togglePending);
		this._register(approve);
		this._register(reject);
		this._register(clear);

		actionbar.push(request, { icon: true, label: true });
		actionbar.push(togglePending, { icon: true, label: true });
		actionbar.push(approve, { icon: true, label: true });
		actionbar.push(reject, { icon: true, label: true });
		actionbar.push(clear, { icon: true, label: true });

		const listContainer = append(container, $('.ira-approvals-list'));
		const delegate = new ApprovalsDelegate();
		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList<ApprovalElement>,
			'IraApprovals',
			listContainer,
			delegate,
			[new ApprovalsRenderer()],
			{
				accessibilityProvider: {
					getAriaLabel: (e: ApprovalElement) => e.item.title,
					getWidgetAriaLabel: () => 'IRA Approvals'
				}
			}
		));

		this._register(this.list.onDidChangeSelection(() => {
			this._onDidChangeSelection.fire(this.getSelected());
		}));

		const legend = append(toolbar, $('.ira-approvals-legend'));
		legend.textContent = '';

		this.refresh(legend);
		this._register(this.approvalsService.onDidChange(() => this.refresh(legend)));
	}

	private refresh(legend?: HTMLElement): void {
		let items = this.approvalsService.getItems();
		const total = items.length;
		const pendingCount = items.filter(i => i.status === 'pending').length;
		const approvedCount = items.filter(i => i.status === 'approved').length;
		const rejectedCount = items.filter(i => i.status === 'rejected').length;

		if (this.showOnlyPending) {
			items = items.filter(i => i.status === 'pending');
		}

		if (legend) {
			legend.textContent = `Pending ${pendingCount} · Approved ${approvedCount} · Rejected ${rejectedCount} · Total ${total}`;
		}

		this.list.splice(0, this.list.length, items.map(item => ({ item } satisfies ApprovalElement)));
	}

	private getSelected(): ApprovalElement | undefined {
		const selected = this.list.getSelectedElements();
		return selected?.[0];
	}

	override dispose(): void {
		this.disposables.dispose();
		super.dispose();
	}
}
