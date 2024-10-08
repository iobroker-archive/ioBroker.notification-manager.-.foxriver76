import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import type { CreateCSSProperties } from '@material-ui/core/styles/withStyles';
import TextField from '@material-ui/core/TextField';
import Input from '@material-ui/core/Input';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import { Button, Tab } from '@material-ui/core';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { I18n } from '@iobroker/adapter-react-v5';
// @ts-expect-error socket-client also has a cjs export
import { Connection } from '@iobroker/socket-client';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import {
    KeyboardArrowUp as KeyboardArrowUpIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon
} from '@mui/icons-material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWarning } from '@fortawesome/free-solid-svg-icons/faWarning';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons/faInfoCircle';
import { faBell } from '@fortawesome/free-regular-svg-icons/faBell';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane';

const styles = (): Record<string, CreateCSSProperties> => ({
    input: {
        marginTop: 0,
        minWidth: 400
    },
    button: {
        marginRight: 20
    },
    card: {
        textAlign: 'left',
        margin: 10
    },
    cardHeaderDark: {
        backgroundColor: '#272727',
        color: 'white',
        fontWeight: 'bold'
    },
    cardHeader: {
        backgroundColor: 'white',
        fontWeight: 'bold'
    },
    media: {
        height: 180
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnLogo: {
        width: 350,
        marginRight: 0
    },
    columnSettings: {
        width: 'calc(100% - 370px)'
    },
    controlElement: {
        marginBottom: 5
    },
    settingsRoot: {
        height: 'calc(100% - 64px)',
        overflow: 'scroll',
        marginLeft: '10px'
    }
});

interface ConfiguredAdapters {
    /** If the adapter should just clear the notification without any handling */
    suppress: boolean;
    /** Try to first let this adapter handle the notification */
    firstAdapter: string;
    /** If first adapter fails, try this one */
    secondAdapter: string;
}

interface CategoryConfiguration extends ConfiguredAdapters {
    /** If category is active */
    active: boolean;
}

interface ConfiguredCategories {
    [scope: string]: {
        [category: string]: CategoryConfiguration;
    };
}

/** e.g. "scope.category.firstAdapter" */
type ConfigurationCategoryAttribute = `${string}.${string}.${string}`;

type NotificationsConfig = Notifications[];

type FallbackConfiguration = {
    [key in Severity]: ConfiguredAdapters;
};

/** The adapter native attribute */
export interface AdapterNative {
    /** Configured notification categories */
    categories: ConfiguredCategories;
    /** Fallback adapters per Severity */
    fallback: FallbackConfiguration;
}

interface ActiveAdapterOptions {
    /** the scope id */
    scope: string;
    /** the category id */
    category: string;
    /** if the adapter is active */
    active: boolean;
}

interface ScopeWithCategory {
    /** the scope id */
    scope: string;
    /** the category id */
    category: string;
}

interface PreprocessAttributesOptions extends ScopeWithCategory {
    /** The actual attributes to set */
    [attribute: string]: unknown;
}

interface Notifications {
    /** the scope id */
    scope: string;
    description: Record<string, string>;
    name: Record<string, string>;
    categories: NotificationCategory[];
}

type Severity = 'alert' | 'notify' | 'info';

interface NotificationCategory {
    /** the category id */
    category: string;
    severity: Severity;
    description: Record<ioBroker.Languages, string>;
    name: Record<ioBroker.Languages, string>;
    limit: number;
    regex: RegExp[];
}

interface SettingsProps {
    classes: Record<string, string>;
    /** The io-pack native attributes */
    native: AdapterNative;
    onChange: (attr: string, value: any) => void;
    /** the adapter namespace */
    namespace: string;
    /** the active language */
    language: ioBroker.Languages;
    /** the active theme */
    theme: 'dark' | 'light';
}

interface SettingsState {
    /** The notifications config from controller */
    notificationsConfig?: NotificationsConfig;
    /** id for each card and open status */
    cardOpen: Record<string, boolean>;
    /** The currently selected tab */
    selectedTab: string;
    /** all instances that can be used to handle notifications */
    supportedAdapterInstances: string[];
}

class Settings extends React.Component<SettingsProps, SettingsState> {
    /** Map severity to icon and color */
    private readonly SEVERITY_MAPPING = {
        notify: {
            icon: faBell,
            color: '#3399cc'
        },
        info: {
            icon: faInfoCircle,
            color: '#3399cc'
        },
        alert: {
            icon: faWarning,
            color: '#ff8f00'
        }
    } as const;

    /** Connection to the backend */
    private readonly conn = new Connection({});

    constructor(props: SettingsProps) {
        super(props);
        this.state = { cardOpen: {}, supportedAdapterInstances: [], selectedTab: '0' };
    }

    renderInput(title: AdminWord, attr: string, type: string): React.JSX.Element {
        return (
            <TextField
                label={I18n.t(title)}
                className={`${this.props.classes.input} ${this.props.classes.controlElement}`}
                value={this.props.native[attr]}
                type={type || 'text'}
                onChange={e => this.props.onChange(attr, e.target.value)}
                margin="normal"
            />
        );
    }

    /**
     * Renders the adapter selection
     *
     * @param title the title from i18n
     * @param attr the attribute path of native
     * @param options title and value of every option
     * @param style additional css style
     */
    renderFallbackAdapterSelect(
        title: AdminWord,
        attr: ConfigurationCategoryAttribute,
        options: { value: string; title: string }[],
        style?: React.CSSProperties
    ): React.JSX.Element {
        const [severity, adapterOrder] = attr.split('.').slice(1);
        options.push({ value: '', title: I18n.t('selectAdapterInstance') });

        return (
            <FormControl
                className={`${this.props.classes.input} ${this.props.classes.controlElement}`}
                style={{
                    paddingTop: 5,
                    ...style
                }}
            >
                <Select
                    value={this.props.native.fallback[severity][adapterOrder] || '_'}
                    onChange={e => {
                        this.props.onChange(attr, e.target.value === '_' ? '' : e.target.value);
                    }}
                    input={<Input name={attr} id={attr + '-helper'} />}
                >
                    {options.map(item => (
                        <MenuItem key={'key-' + item.value} value={item.value || '_'}>
                            {item.title}
                        </MenuItem>
                    ))}
                </Select>
                <FormHelperText>{I18n.t(title)}</FormHelperText>
            </FormControl>
        );
    }

    /**
     * Renders the adapter selection
     *
     * @param title the title from i18n
     * @param attr the attribute path of native
     * @param options title and value of every option
     * @param style additional css style
     */
    renderCategoryAdapterSelect(
        title: AdminWord,
        attr: ConfigurationCategoryAttribute,
        options: { value: string; title: string }[],
        style?: React.CSSProperties
    ): React.JSX.Element {
        const [scope, category, adapterOrder] = attr.split('.');
        options.push({ value: '', title: I18n.t('selectAdapterInstance') });

        return (
            <FormControl
                className={`${this.props.classes.input} ${this.props.classes.controlElement}`}
                style={{
                    paddingTop: 5,
                    ...style
                }}
            >
                <Select
                    value={this.props.native.categories[scope]?.[category]?.[adapterOrder] || '_'}
                    onChange={e => {
                        const val = this.preprocessAdapterSelection(attr, e.target.value === '_' ? '' : e.target.value);
                        this.props.onChange('categories', val);
                    }}
                    input={<Input name={attr} id={attr + '-helper'} />}
                >
                    {options.map(item => (
                        <MenuItem key={'key-' + item.value} value={item.value || '_'}>
                            {item.title}
                        </MenuItem>
                    ))}
                </Select>
                <FormHelperText>{I18n.t(title)}</FormHelperText>
            </FormControl>
        );
    }

    /**
     * Preprocess given attributes by setting them to the category object
     *
     * @param options scope, category and key-value pairs of the attributes
     */
    preprocessAttributes(options: PreprocessAttributesOptions): ConfiguredCategories {
        const { scope, category, ...attributes } = options;

        const categories: ConfiguredCategories = JSON.parse(JSON.stringify(this.props.native.categories));

        if (!categories[scope]) {
            categories[scope] = {};
        }

        if (!categories[scope][category]) {
            categories[scope][category] = { firstAdapter: '', secondAdapter: '', active: true, suppress: false };
        }

        for (const [attrName, attr] of Object.entries(attributes)) {
            categories[scope][category][attrName] = attr;
        }

        return categories;
    }

    /**
     * Preprocess the category object if checkbox is checked
     *
     * @param options the scope, category and activation options of the active adapter
     */
    preprocessAdapterActive(options: ActiveAdapterOptions): ConfiguredCategories {
        const { scope, category, active } = options;

        const categories: ConfiguredCategories = JSON.parse(JSON.stringify(this.props.native.categories));

        if (!categories[scope]) {
            categories[scope] = {};
        }

        if (!categories[scope][category]) {
            categories[scope][category] = { firstAdapter: '', secondAdapter: '', active: true, suppress: false };
        }

        if (!active) {
            categories[scope][category].active = false;
        } else {
            if (!categories[scope][category].firstAdapter && !categories[scope][category].secondAdapter) {
                delete categories[scope][category];
            } else {
                categories[scope][category].active = true;
            }
        }

        return categories;
    }

    /**
     * Preprocess single selection to extend the global native object
     *
     * @param attrPath path to the attribute like "scope.category.firstAdapter"
     * @param value the adapter instance
     */
    preprocessAdapterSelection(attrPath: ConfigurationCategoryAttribute, value: unknown): ConfiguredCategories {
        const [scope, category, adapterOrder] = attrPath.split('.');

        const categories: ConfiguredCategories = JSON.parse(JSON.stringify(this.props.native.categories));

        if (!categories[scope]) {
            categories[scope] = {};
        }

        if (!categories[scope][category]) {
            categories[scope][category] = { firstAdapter: '', secondAdapter: '', active: true, suppress: false };
        }

        categories[scope][category][adapterOrder] = value;

        if (!categories[scope][category].firstAdapter && !categories[scope][category].secondAdapter) {
            delete categories[scope][category];
        }

        if (!Object.keys(categories[scope]).length) {
            delete categories[scope];
        }

        return categories;
    }

    /**
     * Render a checkbox
     *
     * @param title the i18n title
     * @param attr attribute path
     * @param style additional style
     */
    renderAdapterActiveCheckbox(title: AdminWord, attr: string, style?: React.CSSProperties): React.JSX.Element {
        const [scope, category] = attr.split('.');

        return (
            <FormControlLabel
                key={attr}
                style={{
                    paddingTop: 5,
                    ...style
                }}
                className={this.props.classes.controlElement}
                control={
                    <Checkbox
                        checked={this.props.native.categories[scope]?.[category]?.active !== false}
                        onChange={(_event, checked) =>
                            this.props.onChange(
                                'categories',
                                this.preprocessAdapterActive({ scope, category, active: checked })
                            )
                        }
                        color="primary"
                    />
                }
                label={I18n.t(title)}
            />
        );
    }

    /**
     * Check if given category is active
     *
     * @param options scope and category config
     */
    private isCategoryActive(options: ScopeWithCategory): boolean {
        const { scope, category } = options;

        return this.props.native.categories[scope]?.[category]?.active !== false;
    }

    /**
     * Check if the given category is suppressed
     *
     * @param options scope and category config
     */
    private isCategorySuppressed(options: ScopeWithCategory): boolean {
        const { scope, category } = options;

        return !!this.props.native.categories[scope]?.[category]?.suppress;
    }

    /**
     * Render the "suppress category" checkbox
     *
     * @param options scope and category information
     */
    private renderSuppressCategoryCheckbox(options: ScopeWithCategory): React.JSX.Element | null {
        const { category, scope } = options;

        if (!this.isCategoryActive({ scope, category })) {
            return null;
        }

        return (
            <FormControlLabel
                className={this.props.classes.controlElement}
                control={
                    <Checkbox
                        checked={this.props.native.categories[scope]?.[category]?.suppress}
                        onChange={(_event, checked) =>
                            this.props.onChange(
                                'categories',
                                this.preprocessAttributes({ scope, category, suppress: checked })
                            )
                        }
                        color="primary"
                    />
                }
                label={I18n.t('suppressCategory')}
            />
        );
    }

    /**
     * Render all adapter selections for given category
     *
     * @param options scope and category information
     */
    private renderCategoryAdapterSelects(options: ScopeWithCategory): React.JSX.Element | null {
        const { scope, category } = options;

        if (!this.isCategoryActive({ scope, category }) || this.isCategorySuppressed({ scope, category })) {
            return null;
        }

        return (
            <div>
                {this.renderCategoryAdapterSelect(
                    `firstAdapter`,
                    `${scope}.${category}.firstAdapter`,
                    this.state.supportedAdapterInstances.map(instance => {
                        return { value: instance, title: instance };
                    }),
                    {}
                )}
                <br />
                {this.renderCategoryAdapterSelect(
                    'secondAdapter',
                    `${scope}.${category}.secondAdapter`,
                    this.state.supportedAdapterInstances.map(instance => {
                        return { value: instance, title: instance };
                    }),
                    {}
                )}
            </div>
        );
    }

    /**
     * Render the adapter icon on a category card
     *
     * @param adapter the adapter instance id
     */
    renderAdapterIcon(adapter: string): React.JSX.Element | null {
        if (!adapter) {
            return null;
        }

        const adapterName = adapter.split('.')[0];

        return <img src={`/adapter/${adapterName}/${adapterName}.png`} alt={adapter} width={'40px'} title={adapter} />;
    }

    /**
     * Render a card for the category
     *
     * @param scopeId id of the scope
     * @param category the notification category to render card for
     */
    renderCategoryCard(scopeId: string, category: NotificationCategory): React.JSX.Element {
        const elementId = category.category;
        const isActive = this.props.native.categories[scopeId]?.[elementId]?.active ?? true;

        const firstAdapter =
            this.props.native.categories[scopeId]?.[elementId]?.firstAdapter ||
            this.props.native.fallback[category.severity].firstAdapter;

        const secondAdapter =
            this.props.native.categories[scopeId]?.[elementId]?.secondAdapter ||
            this.props.native.fallback[category.severity].secondAdapter;

        return (
            <Card
                sx={{
                    minWidth: 400,
                    border: this.isDarkMode() ? '1px solid rgba(58,58,58,0.6)' : '1px solid rgba(211,211,211,0.6)'
                }}
                className={this.props.classes.card}
            >
                <CardHeader
                    className={this.isDarkMode() ? this.props.classes.cardHeaderDark : this.props.classes.cardHeader}
                    title={category.name[this.props.language]}
                    titleTypographyProps={{ fontWeight: 'bold', fontSize: 16 }}
                    action={
                        <div style={{ display: 'flex' }}>
                            {isActive ? this.renderAdapterIcon(firstAdapter) : null}
                            {isActive ? this.renderAdapterIcon(secondAdapter) : null}
                            <IconButton
                                onClick={() => {
                                    this.setState({
                                        cardOpen: {
                                            ...this.state.cardOpen,
                                            [elementId]: !this.state.cardOpen[elementId]
                                        }
                                    });
                                }}
                                aria-label="expand"
                                size="small"
                                style={{ color: this.isDarkMode() ? 'white' : 'black' }}
                            >
                                {this.state.cardOpen[elementId] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                        </div>
                    }
                />
                <div
                    style={{
                        backgroundColor: this.isDarkMode() ? '#3b3b3b' : 'rgba(211,211,211,0.4)',
                        display: 'flex'
                    }}
                >
                    <Collapse
                        in={this.state.cardOpen[elementId]}
                        timeout="auto"
                        unmountOnExit
                        style={{ width: '100%' }}
                    >
                        <CardContent>
                            <div style={{ display: 'flex' }}>
                                <Container sx={{ lineHeight: 2, color: this.isDarkMode() ? 'white' : 'black' }}>
                                    {category.description[this.props.language]}
                                    <br />
                                    {this.renderAdapterActiveCheckbox(
                                        'categoryActive',
                                        `${scopeId}.${category.category}.active`
                                    )}
                                    <br />
                                    {this.renderSuppressCategoryCheckbox({
                                        scope: scopeId,
                                        category: category.category
                                    })}
                                    {this.renderCategoryAdapterSelects({ scope: scopeId, category: category.category })}
                                </Container>
                                <div style={{ flex: 1, display: 'flex' }}> {this.renderIcon(category.severity)}</div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'end' }}>
                                <Button variant="contained" onClick={() => this.sendTestMessage(scopeId, category)}>
                                    <FontAwesomeIcon
                                        icon={faPaperPlane}
                                        size={'xl'}
                                        color={'black'}
                                        style={{ marginRight: '10px' }}
                                    />
                                    {I18n.t('testMessage')}
                                </Button>
                            </div>
                        </CardContent>
                    </Collapse>
                </div>
            </Card>
        );
    }

    /**
     * Send a test message with the current configuration
     *
     * @param scopeId id of the scope
     * @param category the notification category to render card for
     */
    async sendTestMessage(scopeId: string, category: NotificationCategory): Promise<void> {
        const res = await this.conn.sendTo(this.props.namespace, 'sendTestMessage', {
            scopeId,
            category: category.category
        });

        if (res.ack) {
            console.info('Test message acknowledged');
        }
    }

    /**
     * Render icon for severity
     *
     * @param severity the severity of the category
     */
    renderIcon(severity: Severity): React.JSX.Element {
        const { icon, color } = this.SEVERITY_MAPPING[severity];

        return (
            <FontAwesomeIcon
                style={{ marginLeft: 'auto', alignSelf: 'center' }}
                icon={icon}
                size={'3x'}
                color={color}
            />
        );
    }

    /**
     * Render the main settings
     *
     * @param notificationsConfig the current notifications config
     */
    renderMainSettings(notificationsConfig: NotificationsConfig): React.JSX.Element {
        return (
            <form className={this.props.classes.tab}>
                {notificationsConfig.map(scope => {
                    return (
                        <div key={'settings-root'}>
                            <h2 style={{ color: this.getTextColor(), margin: 10 }} key={scope.scope}>
                                {scope.name[this.props.language]}
                            </h2>
                            {scope.categories.map(category => {
                                return this.renderCategoryCard(scope.scope, category);
                            })}
                        </div>
                    );
                })}
            </form>
        );
    }

    /**
     * Render the additional settings
     */
    renderAdditionalSettings(): React.JSX.Element {
        const severities: Severity[] = ['info', 'notify', 'alert'];

        return (
            <div>
                <h2 style={{ color: this.getTextColor() }}>{I18n.t('fallbackSettings')}</h2>

                {severities.map(severity => {
                    return (
                        <Card
                            key={`${severity}-fallback-card`}
                            sx={{
                                minWidth: 400,
                                border: this.isDarkMode()
                                    ? '1px solid rgba(58,58,58,0.6)'
                                    : '1px solid rgba(211,211,211,0.6)'
                            }}
                            className={this.props.classes.card}
                        >
                            <CardHeader
                                className={
                                    this.isDarkMode()
                                        ? this.props.classes.cardHeaderDark
                                        : this.props.classes.cardHeader
                                }
                                title={`${I18n.t('severity')}: ${severity}`}
                                titleTypographyProps={{ fontWeight: 'bold', fontSize: 16 }}
                            />
                            <CardContent
                                style={{
                                    backgroundColor: this.isDarkMode() ? '#3b3b3b' : 'rgba(211,211,211,0.4)',
                                    display: 'flex'
                                }}
                            >
                                <Container
                                    sx={{
                                        lineHeight: 2,
                                        color: this.getTextColor()
                                    }}
                                >
                                    <div style={{ display: 'flex' }}>
                                        <div style={{ flex: 1 }}>
                                            <br />
                                            {this.renderFallbackAdapterSelect(
                                                `firstAdapter`,
                                                `fallback.${severity}.firstAdapter`,
                                                this.state.supportedAdapterInstances.map(instance => {
                                                    return { value: instance, title: instance };
                                                }),
                                                {}
                                            )}
                                            <br />
                                            {this.renderFallbackAdapterSelect(
                                                'secondAdapter',
                                                `fallback.${severity}.secondAdapter`,
                                                this.state.supportedAdapterInstances.map(instance => {
                                                    return { value: instance, title: instance };
                                                }),
                                                {}
                                            )}
                                        </div>
                                    </div>
                                </Container>
                                <div style={{ flex: 1, display: 'flex' }}>{this.renderIcon(severity)}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        );
    }

    render(): React.JSX.Element {
        if (!this.state.notificationsConfig) {
            return (
                <div>
                    <h2 style={{ color: this.getTextColor() }}>{I18n.t('notRunning')}</h2>
                </div>
            );
        }

        return (
            <div style={{}} className={this.props.classes.settingsRoot}>
                <TabContext value={this.state.selectedTab}>
                    <TabList onChange={(_event, value) => this.setState({ selectedTab: value })}>
                        <Tab label={I18n.t('mainSettings')} value={'0'} />
                        <Tab label={I18n.t('additionalSettings')} value={'1'} />
                    </TabList>
                    <TabPanel value={'0'}>{this.renderMainSettings(this.state.notificationsConfig)}</TabPanel>

                    <TabPanel value={'1'}>{this.renderAdditionalSettings()}</TabPanel>
                </TabContext>
            </div>
        );
    }

    /**
     * React lifecycle hook, called when mounted
     */
    async componentDidMount(): Promise<void> {
        await this.conn.waitForFirstConnection();

        try {
            const { notifications: notificationsConfig } = await this.conn.sendTo(
                this.props.namespace,
                'getCategories'
            );
            const { instances: supportedAdapterInstances } = await this.conn.sendTo(
                this.props.namespace,
                'getSupportedMessengers'
            );

            this.setState({ notificationsConfig, supportedAdapterInstances });
        } catch (e: any) {
            console.error(`Backend communication failed: ${e.message}`);
        }
    }

    /**
     * Get text color according to theme
     */
    getTextColor(): string {
        return this.isDarkMode() ? 'white' : 'black';
    }

    /**
     * Determine if dark mode is active
     */
    isDarkMode(): boolean {
        return this.props.theme === 'dark';
    }
}

export default withStyles(styles)(Settings);
