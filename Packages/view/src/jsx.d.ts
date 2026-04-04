/**
 * JSX type definitions for @hedystia/view
 *
 * Provides type definitions for all HTML and SVG intrinsic elements.
 */

export namespace JSX {
  export type Element = HTMLElement | DocumentFragment | Text | Comment | null;
  export type ElementClass = never;
  export interface ElementChildrenAttribute {
    children: {};
  }

  /**
   * Children type - supports single element, arrays of elements, strings, numbers, or functions (reactive)
   */
  export type Child =
    | Element
    | string
    | number
    | boolean
    | null
    | undefined
    | (() => Child | Child[]);
  export type Children = Child | Child[];

  export interface IntrinsicElements {
    // HTML Elements
    a: AnchorHTMLAttributes;
    abbr: HTMLAttributes;
    address: HTMLAttributes;
    area: AreaHTMLAttributes;
    article: HTMLAttributes;
    aside: HTMLAttributes;
    audio: AudioHTMLAttributes;
    b: HTMLAttributes;
    base: BaseHTMLAttributes;
    bdi: HTMLAttributes;
    bdo: HTMLAttributes;
    big: HTMLAttributes;
    blockquote: BlockquoteHTMLAttributes;
    body: HTMLAttributes;
    br: HTMLAttributes;
    button: ButtonHTMLAttributes;
    canvas: CanvasHTMLAttributes;
    caption: HTMLAttributes;
    cite: HTMLAttributes;
    code: HTMLAttributes;
    col: ColHTMLAttributes;
    colgroup: ColgroupHTMLAttributes;
    data: DataHTMLAttributes;
    datalist: HTMLAttributes;
    dd: HTMLAttributes;
    del: DelHTMLAttributes;
    details: DetailsHTMLAttributes;
    dfn: HTMLAttributes;
    dialog: DialogHTMLAttributes;
    div: HTMLAttributes;
    dl: HTMLAttributes;
    dt: HTMLAttributes;
    em: HTMLAttributes;
    embed: EmbedHTMLAttributes;
    fieldset: FieldsetHTMLAttributes;
    figcaption: HTMLAttributes;
    figure: HTMLAttributes;
    footer: HTMLAttributes;
    form: FormHTMLAttributes;
    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;
    head: HTMLAttributes;
    header: HTMLAttributes;
    hgroup: HTMLAttributes;
    hr: HTMLAttributes;
    html: HTMLAttributes;
    i: HTMLAttributes;
    iframe: IframeHTMLAttributes;
    img: ImgHTMLAttributes;
    input: InputHTMLAttributes;
    ins: InsHTMLAttributes;
    kbd: HTMLAttributes;
    keygen: KeygenHTMLAttributes;
    label: LabelHTMLAttributes;
    legend: HTMLAttributes;
    li: LiHTMLAttributes;
    link: LinkHTMLAttributes;
    main: HTMLAttributes;
    map: MapHTMLAttributes;
    mark: HTMLAttributes;
    menu: MenuHTMLAttributes;
    menuitem: HTMLAttributes;
    meta: MetaHTMLAttributes;
    meter: MeterHTMLAttributes;
    nav: HTMLAttributes;
    noscript: HTMLAttributes;
    object: ObjectHTMLAttributes;
    ol: OlHTMLAttributes;
    optgroup: OptgroupHTMLAttributes;
    option: OptionHTMLAttributes;
    output: OutputHTMLAttributes;
    p: HTMLAttributes;
    param: ParamHTMLAttributes;
    picture: HTMLAttributes;
    pre: HTMLAttributes;
    progress: ProgressHTMLAttributes;
    q: QuoteHTMLAttributes;
    rp: HTMLAttributes;
    rt: HTMLAttributes;
    ruby: HTMLAttributes;
    s: HTMLAttributes;
    samp: HTMLAttributes;
    script: ScriptHTMLAttributes;
    section: HTMLAttributes;
    select: SelectHTMLAttributes;
    small: HTMLAttributes;
    source: SourceHTMLAttributes;
    span: HTMLAttributes;
    strong: HTMLAttributes;
    style: StyleHTMLAttributes;
    sub: HTMLAttributes;
    summary: HTMLAttributes;
    sup: HTMLAttributes;
    table: TableHTMLAttributes;
    tbody: HTMLAttributes;
    td: TdHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    tfoot: HTMLAttributes;
    th: ThHTMLAttributes;
    thead: HTMLAttributes;
    time: TimeHTMLAttributes;
    title: HTMLAttributes;
    tr: HTMLAttributes;
    track: TrackHTMLAttributes;
    u: HTMLAttributes;
    ul: HTMLAttributes;
    var: HTMLAttributes;
    video: VideoHTMLAttributes;
    wbr: HTMLAttributes;

    // SVG Elements
    svg: SvgHTMLAttributes;
    animate: AnimateHTMLAttributes;
    animateMotion: AnimateMotionHTMLAttributes;
    animateTransform: AnimateTransformHTMLAttributes;
    circle: CircleHTMLAttributes;
    clipPath: ClipPathHTMLAttributes;
    defs: DefsHTMLAttributes;
    desc: DescHTMLAttributes;
    ellipse: EllipseHTMLAttributes;
    feBlend: FeBlendHTMLAttributes;
    feColorMatrix: FeColorMatrixHTMLAttributes;
    feComponentTransfer: FeComponentTransferHTMLAttributes;
    feComposite: FeCompositeHTMLAttributes;
    feConvolveMatrix: FeConvolveMatrixHTMLAttributes;
    feDiffuseLighting: FeDiffuseLightingHTMLAttributes;
    feDisplacementMap: FeDisplacementMapHTMLAttributes;
    feDistantLight: FeDistantLightHTMLAttributes;
    feDropShadow: FeDropShadowHTMLAttributes;
    feFlood: FeFloodHTMLAttributes;
    feFuncA: FeFuncAHTMLAttributes;
    feFuncB: FeFuncBHTMLAttributes;
    feFuncG: FeFuncGHTMLAttributes;
    feFuncR: FeFuncRHTMLAttributes;
    feGaussianBlur: FeGaussianBlurHTMLAttributes;
    feImage: FeImageHTMLAttributes;
    feMerge: FeMergeHTMLAttributes;
    feMergeNode: FeMergeNodeHTMLAttributes;
    feMorphology: FeMorphologyHTMLAttributes;
    feOffset: FeOffsetHTMLAttributes;
    fePointLight: FePointLightHTMLAttributes;
    feSpecularLighting: FeSpecularLightingHTMLAttributes;
    feSpotLight: FeSpotLightHTMLAttributes;
    feTile: FeTileHTMLAttributes;
    feTurbulence: FeTurbulenceHTMLAttributes;
    filter: FilterHTMLAttributes;
    foreignObject: ForeignObjectHTMLAttributes;
    g: GHTMLAttributes;
    image: ImageHTMLAttributes;
    line: LineHTMLAttributes;
    linearGradient: LinearGradientHTMLAttributes;
    marker: MarkerHTMLAttributes;
    mask: MaskHTMLAttributes;
    metadata: MetadataHTMLAttributes;
    mpath: MpathHTMLAttributes;
    path: PathHTMLAttributes;
    pattern: PatternHTMLAttributes;
    polygon: PolygonHTMLAttributes;
    polyline: PolylineHTMLAttributes;
    radialGradient: RadialGradientHTMLAttributes;
    rect: RectHTMLAttributes;
    stop: StopHTMLAttributes;
    switch: SwitchHTMLAttributes;
    symbol: SymbolHTMLAttributes;
    text: TextHTMLAttributes;
    textPath: TextPathHTMLAttributes;
    tspan: TspanHTMLAttributes;
    use: UseHTMLAttributes;
    view: ViewHTMLAttributes;
  }

  // Base HTML Attributes
  export interface HTMLAttributes {
    accesskey?: string;
    class?: string;
    className?: string;
    contenteditable?: boolean | "true" | "false" | "plaintext-only";
    contextmenu?: string;
    dir?: "ltr" | "rtl" | "auto";
    draggable?: boolean | "true" | "false";
    hidden?: boolean | "hidden" | "until-found";
    id?: string;
    lang?: string;
    slot?: string;
    spellcheck?: boolean | "true" | "false";
    style?:
      | string
      | Record<string, string | number | undefined>
      | (() => string | Record<string, string | number | undefined>);
    tabindex?: number | string;
    title?: string;
    translate?: "yes" | "no";
    onClick?: (event: MouseEvent) => void;
    onContextMenu?: (event: MouseEvent) => void;
    onDblClick?: (event: MouseEvent) => void;
    onDrag?: (event: DragEvent) => void;
    onDragEnd?: (event: DragEvent) => void;
    onDragEnter?: (event: DragEvent) => void;
    onDragLeave?: (event: DragEvent) => void;
    onDragOver?: (event: DragEvent) => void;
    onDragStart?: (event: DragEvent) => void;
    onDrop?: (event: DragEvent) => void;
    onMouseDown?: (event: MouseEvent) => void;
    onMouseEnter?: (event: MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent) => void;
    onMouseMove?: (event: MouseEvent) => void;
    onMouseOut?: (event: MouseEvent) => void;
    onMouseOver?: (event: MouseEvent) => void;
    onMouseUp?: (event: MouseEvent) => void;
    onTouchCancel?: (event: TouchEvent) => void;
    onTouchEnd?: (event: TouchEvent) => void;
    onTouchMove?: (event: TouchEvent) => void;
    onTouchStart?: (event: TouchEvent) => void;
    onWheel?: (event: WheelEvent) => void;
    onInput?: (event: Event) => void;
    onChange?: (event: Event) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    onKeyUp?: (event: KeyboardEvent) => void;
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    onScroll?: (event: UIEvent) => void;
    onLoad?: (event: Event) => void;
    onError?: (event: Event) => void;
    children?: JSX.Children;
  }

  // Specific Element Attributes (extending HTMLAttributes)
  export interface AnchorHTMLAttributes extends HTMLAttributes {
    download?: string;
    href?: string;
    hreflang?: string;
    media?: string;
    ping?: string;
    referrerpolicy?: string;
    rel?: string;
    target?: string;
    type?: string;
  }

  export interface AreaHTMLAttributes extends HTMLAttributes {
    alt?: string;
    coords?: string;
    download?: string;
    href?: string;
    hreflang?: string;
    media?: string;
    referrerpolicy?: string;
    rel?: string;
    shape?: string;
    target?: string;
  }

  export interface AudioHTMLAttributes extends HTMLAttributes {
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
    muted?: boolean;
    preload?: string;
    src?: string;
  }

  export interface BaseHTMLAttributes extends HTMLAttributes {
    href?: string;
    target?: string;
  }

  export interface BlockquoteHTMLAttributes extends HTMLAttributes {
    cite?: string;
  }

  export interface ButtonHTMLAttributes extends HTMLAttributes {
    autofocus?: boolean;
    disabled?: boolean;
    form?: string;
    formaction?: string;
    formenctype?: string;
    formmethod?: string;
    formnovalidate?: boolean;
    formtarget?: string;
    name?: string;
    type?: string;
    value?: string;
  }

  export interface CanvasHTMLAttributes extends HTMLAttributes {
    height?: number | string;
    width?: number | string;
  }

  export interface ColHTMLAttributes extends HTMLAttributes {
    span?: number | string;
  }

  export interface ColgroupHTMLAttributes extends HTMLAttributes {
    span?: number | string;
  }

  export interface DataHTMLAttributes extends HTMLAttributes {
    value?: string;
  }

  export interface DelHTMLAttributes extends HTMLAttributes {
    cite?: string;
    datetime?: string;
  }

  export interface DetailsHTMLAttributes extends HTMLAttributes {
    open?: boolean;
  }

  export interface DialogHTMLAttributes extends HTMLAttributes {
    open?: boolean;
  }

  export interface EmbedHTMLAttributes extends HTMLAttributes {
    height?: number | string;
    src?: string;
    type?: string;
    width?: number | string;
  }

  export interface FieldsetHTMLAttributes extends HTMLAttributes {
    disabled?: boolean;
    form?: string;
    name?: string;
  }

  export interface FormHTMLAttributes extends HTMLAttributes {
    acceptcharset?: string;
    action?: string;
    autocomplete?: string;
    enctype?: string;
    method?: string;
    name?: string;
    novalidate?: boolean;
    target?: string;
  }

  export interface IframeHTMLAttributes extends HTMLAttributes {
    allow?: string;
    allowfullscreen?: boolean;
    allowpaymentrequest?: boolean;
    height?: number | string;
    loading?: "eager" | "lazy";
    name?: string;
    referrerpolicy?: string;
    sandbox?: string;
    src?: string;
    srcdoc?: string;
    width?: number | string;
  }

  export interface ImgHTMLAttributes extends HTMLAttributes {
    alt?: string;
    crossorigin?: string;
    decoding?: "async" | "auto" | "sync";
    height?: number | string;
    loading?: "eager" | "lazy";
    referrerpolicy?: string;
    sizes?: string;
    src?: string;
    srcset?: string;
    usemap?: string;
    width?: number | string;
  }

  export interface InputHTMLAttributes extends HTMLAttributes {
    accept?: string;
    alt?: string;
    autocomplete?: string;
    autofocus?: boolean;
    capture?: boolean | string;
    checked?: boolean;
    crossorigin?: string;
    disabled?: boolean;
    form?: string;
    formaction?: string;
    formenctype?: string;
    formmethod?: string;
    formnovalidate?: boolean;
    formtarget?: string;
    height?: number | string;
    list?: string;
    max?: number | string;
    maxlength?: number | string;
    min?: number | string;
    minlength?: number | string;
    multiple?: boolean;
    name?: string;
    pattern?: string;
    placeholder?: string;
    readonly?: boolean;
    required?: boolean;
    size?: number | string;
    src?: string;
    step?: number | string;
    type?: string;
    value?: string;
    width?: number | string;
  }

  export interface InsHTMLAttributes extends HTMLAttributes {
    cite?: string;
    datetime?: string;
  }

  export interface KeygenHTMLAttributes extends HTMLAttributes {
    autofocus?: boolean;
    challenge?: string;
    disabled?: boolean;
    form?: string;
    keytype?: string;
    name?: string;
  }

  export interface LabelHTMLAttributes extends HTMLAttributes {
    form?: string;
    for?: string;
  }

  export interface LiHTMLAttributes extends HTMLAttributes {
    value?: number | string;
  }

  export interface LinkHTMLAttributes extends HTMLAttributes {
    as?: string;
    crossorigin?: string;
    href?: string;
    hreflang?: string;
    integrity?: string;
    media?: string;
    referrerpolicy?: string;
    rel?: string;
    sizes?: string;
    type?: string;
  }

  export interface MapHTMLAttributes extends HTMLAttributes {
    name?: string;
  }

  export interface MenuHTMLAttributes extends HTMLAttributes {
    type?: string;
  }

  export interface MetaHTMLAttributes extends HTMLAttributes {
    charset?: string;
    content?: string;
    httpequiv?: string;
    media?: string;
    name?: string;
  }

  export interface MeterHTMLAttributes extends HTMLAttributes {
    form?: string;
    high?: number | string;
    low?: number | string;
    max?: number | string;
    min?: number | string;
    optimum?: number | string;
    value?: number | string;
  }

  export interface ObjectHTMLAttributes extends HTMLAttributes {
    data?: string;
    form?: string;
    height?: number | string;
    name?: string;
    type?: string;
    usemap?: string;
    width?: number | string;
  }

  export interface OlHTMLAttributes extends HTMLAttributes {
    reversed?: boolean;
    start?: number | string;
    type?: string;
  }

  export interface OptgroupHTMLAttributes extends HTMLAttributes {
    disabled?: boolean;
    label?: string;
  }

  export interface OptionHTMLAttributes extends HTMLAttributes {
    disabled?: boolean;
    label?: string;
    selected?: boolean;
    value?: string;
  }

  export interface OutputHTMLAttributes extends HTMLAttributes {
    form?: string;
    for?: string;
    name?: string;
  }

  export interface ParamHTMLAttributes extends HTMLAttributes {
    name?: string;
    value?: string;
  }

  export interface ProgressHTMLAttributes extends HTMLAttributes {
    max?: number | string;
    value?: number | string;
  }

  export interface QuoteHTMLAttributes extends HTMLAttributes {
    cite?: string;
  }

  export interface ScriptHTMLAttributes extends HTMLAttributes {
    async?: boolean;
    charset?: string;
    crossorigin?: string;
    defer?: boolean;
    integrity?: string;
    nomodule?: boolean;
    referrerpolicy?: string;
    src?: string;
    type?: string;
  }

  export interface SelectHTMLAttributes extends HTMLAttributes {
    autocomplete?: string;
    autofocus?: boolean;
    disabled?: boolean;
    form?: string;
    multiple?: boolean;
    name?: string;
    required?: boolean;
    size?: number | string;
    value?: string;
  }

  export interface SourceHTMLAttributes extends HTMLAttributes {
    media?: string;
    sizes?: string;
    src?: string;
    srcset?: string;
    type?: string;
  }

  export interface StyleHTMLAttributes extends HTMLAttributes {
    media?: string;
    type?: string;
  }

  export interface TableHTMLAttributes extends HTMLAttributes {
    align?: string;
    border?: number | string;
    cellpadding?: number | string;
    cellspacing?: number | string;
    summary?: string;
    width?: number | string;
  }

  export interface TdHTMLAttributes extends HTMLAttributes {
    align?: string;
    colspan?: number | string;
    headers?: string;
    rowspan?: number | string;
    scope?: string;
    valign?: string;
    width?: number | string;
  }

  export interface TextareaHTMLAttributes extends HTMLAttributes {
    autocomplete?: string;
    autofocus?: boolean;
    cols?: number | string;
    dirname?: string;
    disabled?: boolean;
    form?: string;
    maxlength?: number | string;
    minlength?: number | string;
    name?: string;
    placeholder?: string;
    readonly?: boolean;
    required?: boolean;
    rows?: number | string;
    wrap?: string;
    value?: string;
  }

  export interface ThHTMLAttributes extends HTMLAttributes {
    align?: string;
    colspan?: number | string;
    headers?: string;
    rowspan?: number | string;
    scope?: string;
    valign?: string;
    width?: number | string;
  }

  export interface TimeHTMLAttributes extends HTMLAttributes {
    datetime?: string;
  }

  export interface TrackHTMLAttributes extends HTMLAttributes {
    default?: boolean;
    kind?: string;
    label?: string;
    src?: string;
    srclang?: string;
  }

  export interface VideoHTMLAttributes extends HTMLAttributes {
    autoplay?: boolean;
    controls?: boolean;
    height?: number | string;
    loop?: boolean;
    muted?: boolean;
    playsinline?: boolean;
    poster?: string;
    preload?: string;
    src?: string;
    width?: number | string;
  }

  // SVG Attributes
  export interface SvgHTMLAttributes extends HTMLAttributes {
    height?: number | string;
    preserveAspectRatio?: string;
    viewBox?: string;
    width?: number | string;
    xmlns?: string;
  }

  export interface CircleHTMLAttributes extends SVGAttributes {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
  }

  export interface EllipseHTMLAttributes extends SVGAttributes {
    cx?: number | string;
    cy?: number | string;
    rx?: number | string;
    ry?: number | string;
  }

  export interface LineHTMLAttributes extends SVGAttributes {
    x1?: number | string;
    x2?: number | string;
    y1?: number | string;
    y2?: number | string;
  }

  export interface PathHTMLAttributes extends SVGAttributes {
    d?: string;
    pathLength?: number | string;
  }

  export interface PolygonHTMLAttributes extends SVGAttributes {
    points?: string;
  }

  export interface PolylineHTMLAttributes extends SVGAttributes {
    points?: string;
  }

  export interface RectHTMLAttributes extends SVGAttributes {
    height?: number | string;
    rx?: number | string;
    ry?: number | string;
    width?: number | string;
    x?: number | string;
    y?: number | string;
  }

  export interface TextHTMLAttributes extends SVGAttributes {
    dx?: number | string;
    dy?: number | string;
    lengthAdjust?: string;
    textLength?: number | string;
    x?: number | string;
    y?: number | string;
  }

  export interface ImageHTMLAttributes extends SVGAttributes {
    height?: number | string;
    href?: string;
    preserveAspectRatio?: string;
    width?: number | string;
    x?: number | string;
    y?: number | string;
  }

  export interface GHTMLAttributes extends SVGAttributes {}

  export interface SVGAttributes extends HTMLAttributes {
    accentHeight?: number | string;
    accumulate?: string;
    additive?: string;
    alignmentBaseline?: string;
    allowReorder?: string;
    alphabetic?: number | string;
    amplitude?: number | string;
    arabicForm?: string;
    ascent?: number | string;
    attributeName?: string;
    attributeType?: string;
    autoReverse?: string;
    azimuth?: number | string;
    baseFrequency?: number | string;
    baselineShift?: number | string;
    baseProfile?: number | string;
    bbox?: number | string;
    begin?: number | string;
    bias?: number | string;
    by?: number | string;
    calcMode?: string;
    capHeight?: number | string;
    clip?: number | string;
    clipPath?: string;
    clipPathUnits?: number | string;
    clipRule?: string;
    color?: string;
    colorInterpolation?: string;
    colorInterpolationFilters?: string;
    colorProfile?: string;
    colorRendering?: string;
    contentScriptType?: string;
    contentStyleType?: string;
    cursor?: string;
    cx?: number | string;
    cy?: number | string;
    d?: string;
    decelerate?: number | string;
    descent?: number | string;
    diffuseConstant?: number | string;
    direction?: string;
    display?: string;
    divisor?: number | string;
    dominantBaseline?: string;
    dur?: number | string;
    dx?: number | string;
    dy?: number | string;
    edgeMode?: string;
    elevation?: number | string;
    enableBackground?: string;
    end?: number | string;
    exponent?: number | string;
    externalResourcesRequired?: string;
    fill?: string;
    fillOpacity?: number | string;
    fillRule?: string;
    filter?: string;
    filterRes?: number | string;
    filterUnits?: number | string;
    floodColor?: string;
    floodOpacity?: number | string;
    focusable?: string;
    fontFamily?: string;
    fontSize?: number | string;
    fontSizeAdjust?: number | string;
    fontStretch?: string;
    fontStyle?: string;
    fontVariant?: string;
    fontWeight?: number | string;
    format?: number | string;
    fr?: number | string;
    from?: number | string;
    fx?: number | string;
    fy?: number | string;
    g1?: number | string;
    g2?: number | string;
    glyphName?: number | string;
    glyphOrientationHorizontal?: number | string;
    glyphOrientationVertical?: number | string;
    glyphRef?: number | string;
    gradientTransform?: string;
    gradientUnits?: string;
    hanging?: number | string;
    horizAdvX?: number | string;
    horizOriginX?: number | string;
    href?: string;
    ideographic?: number | string;
    imageRendering?: string;
    in2?: number | string;
    in?: string;
    intercept?: number | string;
    k1?: number | string;
    k2?: number | string;
    k3?: number | string;
    k4?: number | string;
    k?: number | string;
    kernelMatrix?: number | string;
    kernelUnitLength?: number | string;
    kerning?: number | string;
    keyPoints?: number | string;
    keySplines?: number | string;
    keyTimes?: number | string;
    lengthAdjust?: number | string;
    letterSpacing?: number | string;
    lightingColor?: string;
    limitingConeAngle?: number | string;
    local?: number | string;
    markerEnd?: string;
    markerHeight?: number | string;
    markerMid?: string;
    markerStart?: string;
    markerUnits?: number | string;
    markerWidth?: number | string;
    mask?: string;
    maskContentUnits?: number | string;
    maskUnits?: number | string;
    mathematical?: number | string;
    mode?: string;
    numOctaves?: number | string;
    offset?: number | string;
    opacity?: number | string;
    operator?: string;
    order?: number | string;
    orient?: string;
    orientation?: number | string;
    origin?: number | string;
    overflow?: string;
    overlinePosition?: number | string;
    overlineThickness?: number | string;
    paintOrder?: string;
    panose1?: number | string;
    path?: string;
    pathLength?: number | string;
    patternContentUnits?: string;
    patternTransform?: number | string;
    patternUnits?: string;
    pointerEvents?: string;
    points?: string;
    pointsAtX?: number | string;
    pointsAtY?: number | string;
    pointsAtZ?: number | string;
    preserveAlpha?: number | string;
    preserveAspectRatio?: string;
    primitiveUnits?: number | string;
    r?: number | string;
    radius?: number | string;
    refX?: number | string;
    refY?: number | string;
    renderingIntent?: string;
    repeatCount?: number | string;
    repeatDur?: number | string;
    requiredExtensions?: number | string;
    requiredFeatures?: number | string;
    restart?: number | string;
    result?: string;
    rotate?: number | string;
    rx?: number | string;
    ry?: number | string;
    scale?: number | string;
    seed?: number | string;
    shapeRendering?: string;
    slope?: number | string;
    spacing?: number | string;
    specularConstant?: number | string;
    specularExponent?: number | string;
    speed?: number | string;
    spreadMethod?: string;
    startOffset?: number | string;
    stdDeviation?: number | string;
    stemh?: number | string;
    stemv?: number | string;
    stitchTiles?: number | string;
    stopColor?: string;
    stopOpacity?: number | string;
    strikethroughPosition?: number | string;
    strikethroughThickness?: number | string;
    string?: number | string;
    stroke?: string;
    strokeDasharray?: string | number;
    strokeDashoffset?: string | number;
    strokeLinecap?: string;
    strokeLinejoin?: string;
    strokeMiterlimit?: number | string;
    strokeOpacity?: number | string;
    strokeWidth?: number | string;
    surfaceScale?: number | string;
    systemLanguage?: number | string;
    tableValues?: number | string;
    targetX?: number | string;
    targetY?: number | string;
    textAnchor?: string;
    textDecoration?: number | string;
    textLength?: number | string;
    textRendering?: string;
    to?: number | string;
    transform?: string;
    u1?: number | string;
    u2?: number | string;
    underlinePosition?: number | string;
    underlineThickness?: number | string;
    unicode?: number | string;
    unicodeBidi?: string;
    unicodeRange?: number | string;
    unitsPerEm?: number | string;
    vAlphabetic?: number | string;
    values?: string;
    vectorEffect?: string;
    version?: string;
    vertAdvY?: number | string;
    vertOriginX?: number | string;
    vertOriginY?: number | string;
    vHanging?: number | string;
    vIdeographic?: number | string;
    viewBox?: string;
    viewTarget?: number | string;
    visibility?: string;
    vMathematical?: number | string;
    widths?: number | string;
    wordSpacing?: number | string;
    writingMode?: string;
    x1?: number | string;
    x2?: number | string;
    x?: number | string;
    xChannelSelector?: string;
    xHeight?: number | string;
    xlinkActuate?: string;
    xlinkArcrole?: string;
    xlinkHref?: string;
    xlinkRole?: string;
    xlinkShow?: string;
    xlinkTitle?: string;
    xlinkType?: string;
    xmlBase?: string;
    xmlLang?: string;
    xmlns?: string;
    xmlnsXlink?: string;
    xmlSpace?: string;
    y1?: number | string;
    y2?: number | string;
    y?: number | string;
    yChannelSelector?: string;
    z?: number | string;
    zoomAndPan?: string;
  }

  // Other SVG element attributes (extending SVGAttributes)
  export interface AnimateHTMLAttributes extends SVGAttributes {}
  export interface AnimateMotionHTMLAttributes extends SVGAttributes {}
  export interface AnimateTransformHTMLAttributes extends SVGAttributes {}
  export interface ClipPathHTMLAttributes extends SVGAttributes {}
  export interface DefsHTMLAttributes extends SVGAttributes {}
  export interface DescHTMLAttributes extends SVGAttributes {}
  export interface FeBlendHTMLAttributes extends SVGAttributes {}
  export interface FeColorMatrixHTMLAttributes extends SVGAttributes {}
  export interface FeComponentTransferHTMLAttributes extends SVGAttributes {}
  export interface FeCompositeHTMLAttributes extends SVGAttributes {}
  export interface FeConvolveMatrixHTMLAttributes extends SVGAttributes {}
  export interface FeDiffuseLightingHTMLAttributes extends SVGAttributes {}
  export interface FeDisplacementMapHTMLAttributes extends SVGAttributes {}
  export interface FeDistantLightHTMLAttributes extends SVGAttributes {}
  export interface FeDropShadowHTMLAttributes extends SVGAttributes {}
  export interface FeFloodHTMLAttributes extends SVGAttributes {}
  export interface FeFuncAHTMLAttributes extends SVGAttributes {}
  export interface FeFuncBHTMLAttributes extends SVGAttributes {}
  export interface FeFuncGHTMLAttributes extends SVGAttributes {}
  export interface FeFuncRHTMLAttributes extends SVGAttributes {}
  export interface FeGaussianBlurHTMLAttributes extends SVGAttributes {}
  export interface FeImageHTMLAttributes extends SVGAttributes {}
  export interface FeMergeHTMLAttributes extends SVGAttributes {}
  export interface FeMergeNodeHTMLAttributes extends SVGAttributes {}
  export interface FeMorphologyHTMLAttributes extends SVGAttributes {}
  export interface FeOffsetHTMLAttributes extends SVGAttributes {}
  export interface FePointLightHTMLAttributes extends SVGAttributes {}
  export interface FeSpecularLightingHTMLAttributes extends SVGAttributes {}
  export interface FeSpotLightHTMLAttributes extends SVGAttributes {}
  export interface FeTileHTMLAttributes extends SVGAttributes {}
  export interface FeTurbulenceHTMLAttributes extends SVGAttributes {}
  export interface FilterHTMLAttributes extends SVGAttributes {}
  export interface ForeignObjectHTMLAttributes extends SVGAttributes {}
  export interface LinearGradientHTMLAttributes extends SVGAttributes {}
  export interface MarkerHTMLAttributes extends SVGAttributes {}
  export interface MaskHTMLAttributes extends SVGAttributes {}
  export interface MetadataHTMLAttributes extends SVGAttributes {}
  export interface MpathHTMLAttributes extends SVGAttributes {}
  export interface PatternHTMLAttributes extends SVGAttributes {}
  export interface RadialGradientHTMLAttributes extends SVGAttributes {}
  export interface StopHTMLAttributes extends SVGAttributes {}
  export interface SwitchHTMLAttributes extends SVGAttributes {}
  export interface SymbolHTMLAttributes extends SVGAttributes {}
  export interface TextPathHTMLAttributes extends SVGAttributes {}
  export interface TspanHTMLAttributes extends SVGAttributes {}
  export interface UseHTMLAttributes extends SVGAttributes {}
  export interface ViewHTMLAttributes extends SVGAttributes {}
}
