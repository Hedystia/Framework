use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(
    inline_js = "export function is_instance_of(val, ctor) { return val instanceof ctor; }"
)]
extern "C" {
    fn is_instance_of(val: &JsValue, ctor: &JsValue) -> bool;
}

#[derive(Serialize)]
pub struct Issue {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<Vec<String>>,
}

#[derive(Clone)]
enum SchemaType {
    String {
        min_len: Option<usize>,
        max_len: Option<usize>,
        format: Option<StringFormat>,
        coerce: bool,
    },
    Number {
        min: Option<f64>,
        max: Option<f64>,
        coerce: bool,
    },
    Boolean {
        coerce: bool,
    },
    Object {
        props: HashMap<String, HSchema>,
    },
    Array {
        item_schema: Box<HSchema>,
    },
    Literal {
        value: JsValue,
    },
    Union {
        schemas: Vec<HSchema>,
    },
    InstanceOf {
        ctor: js_sys::Function,
        name: String,
    },
    Any,
    Null,
}

#[derive(Clone)]
enum StringFormat {
    Uuid,
    Email,
    Regex(String),
    Phone,
    Domain { require_protocol: bool },
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct HSchema {
    inner: SchemaType,
    is_optional: bool,
    json_schema: js_sys::Object,
}

#[wasm_bindgen]
impl HSchema {
    pub fn string() -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"string".into()).unwrap();

        HSchema {
            inner: SchemaType::String {
                min_len: None,
                max_len: None,
                format: None,
                coerce: false,
            },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn number() -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"number".into()).unwrap();

        HSchema {
            inner: SchemaType::Number {
                min: None,
                max: None,
                coerce: false,
            },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn boolean() -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"boolean".into()).unwrap();

        HSchema {
            inner: SchemaType::Boolean { coerce: false },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn any() -> HSchema {
        HSchema {
            inner: SchemaType::Any,
            is_optional: false,
            json_schema: js_sys::Object::new(),
        }
    }

    pub fn null_type() -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"null".into()).unwrap();
        HSchema {
            inner: SchemaType::Null,
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn literal(val: JsValue) -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"const".into(), &val).unwrap();
        HSchema {
            inner: SchemaType::Literal { value: val },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn object() -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"object".into()).unwrap();
        js_sys::Reflect::set(&obj, &"properties".into(), &js_sys::Object::new()).unwrap();

        HSchema {
            inner: SchemaType::Object {
                props: HashMap::new(),
            },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn array(item: &HSchema) -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"array".into()).unwrap();
        js_sys::Reflect::set(&obj, &"items".into(), &item.json_schema).unwrap();

        HSchema {
            inner: SchemaType::Array {
                item_schema: Box::new(item.clone()),
            },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn union(schemas_arr: Vec<HSchema>) -> HSchema {
        let obj = js_sys::Object::new();
        let json_schemas = js_sys::Array::new();
        for s in &schemas_arr {
            json_schemas.push(&s.json_schema);
        }
        js_sys::Reflect::set(&obj, &"anyOf".into(), &json_schemas).unwrap();

        HSchema {
            inner: SchemaType::Union {
                schemas: schemas_arr,
            },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn instance_of(ctor: js_sys::Function, name: String) -> HSchema {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"type".into(), &"object".into()).unwrap();
        js_sys::Reflect::set(&obj, &"instanceOf".into(), &name.clone().into()).unwrap();

        HSchema {
            inner: SchemaType::InstanceOf { ctor, name },
            is_optional: false,
            json_schema: obj,
        }
    }

    pub fn optional(&self) -> HSchema {
        let mut new_schema = self.clone();
        new_schema.is_optional = true;
        new_schema
    }

    pub fn coerce(&self) -> HSchema {
        let mut new_schema = self.clone();
        match &mut new_schema.inner {
            SchemaType::String { coerce, .. } => *coerce = true,
            SchemaType::Number { coerce, .. } => *coerce = true,
            SchemaType::Boolean { coerce, .. } => *coerce = true,
            _ => {}
        }
        new_schema
    }

    pub fn min_length(&self, n: usize) -> HSchema {
        let mut new_schema = self.clone();
        if let SchemaType::String { min_len, .. } = &mut new_schema.inner {
            *min_len = Some(n);
            js_sys::Reflect::set(
                &new_schema.json_schema,
                &"minLength".into(),
                &JsValue::from(n as u32),
            )
            .unwrap();
        }
        new_schema
    }

    pub fn max_length(&self, n: usize) -> HSchema {
        let mut new_schema = self.clone();
        if let SchemaType::String { max_len, .. } = &mut new_schema.inner {
            *max_len = Some(n);
            js_sys::Reflect::set(
                &new_schema.json_schema,
                &"maxLength".into(),
                &JsValue::from(n as u32),
            )
            .unwrap();
        }
        new_schema
    }

    pub fn uuid(&self) -> HSchema {
        self.set_format(StringFormat::Uuid, "uuid")
    }

    pub fn email(&self) -> HSchema {
        self.set_format(StringFormat::Email, "email")
    }

    pub fn regex(&self, pattern: String) -> HSchema {
        self.set_format(StringFormat::Regex(pattern.clone()), &pattern)
    }

    pub fn phone(&self) -> HSchema {
        self.set_format(StringFormat::Phone, "phone")
    }

    pub fn domain(&self, require_protocol: bool) -> HSchema {
        self.set_format(StringFormat::Domain { require_protocol }, "domain")
    }

    pub fn min(&self, n: f64) -> HSchema {
        let mut new_schema = self.clone();
        if let SchemaType::Number { min, .. } = &mut new_schema.inner {
            *min = Some(n);
            js_sys::Reflect::set(
                &new_schema.json_schema,
                &"minimum".into(),
                &JsValue::from(n),
            )
            .unwrap();
        }
        new_schema
    }

    pub fn max(&self, n: f64) -> HSchema {
        let mut new_schema = self.clone();
        if let SchemaType::Number { max, .. } = &mut new_schema.inner {
            *max = Some(n);
            js_sys::Reflect::set(
                &new_schema.json_schema,
                &"maximum".into(),
                &JsValue::from(n),
            )
            .unwrap();
        }
        new_schema
    }

    pub fn add_prop(&mut self, key: String, schema: &HSchema) {
        if let SchemaType::Object { props } = &mut self.inner {
            props.insert(key.clone(), schema.clone());
        }
    }

    pub fn validate(&self, value: JsValue) -> JsValue {
        match self.validate_inner(&value, None) {
            Ok(val) => {
                let obj = js_sys::Object::new();
                js_sys::Reflect::set(&obj, &"value".into(), &val).unwrap();
                obj.into()
            }
            Err(issues) => {
                let obj = js_sys::Object::new();
                let issues_val = serde_wasm_bindgen::to_value(&issues).unwrap();
                js_sys::Reflect::set(&obj, &"issues".into(), &issues_val).unwrap();
                obj.into()
            }
        }
    }

    pub fn get_json_schema(&self) -> JsValue {
        self.json_schema.clone().into()
    }
}

impl HSchema {
    fn set_format(&self, format: StringFormat, json_format_val: &str) -> HSchema {
        let mut new_schema = self.clone();
        if let SchemaType::String { format: f, .. } = &mut new_schema.inner {
            *f = Some(format);
            js_sys::Reflect::set(
                &new_schema.json_schema,
                &"format".into(),
                &json_format_val.into(),
            )
            .unwrap();
        }
        new_schema
    }

    fn validate_inner(
        &self,
        value: &JsValue,
        path: Option<Vec<String>>,
    ) -> Result<JsValue, Vec<Issue>> {
        if value.is_undefined() || value.is_null() {
            if self.is_optional || (matches!(self.inner, SchemaType::Null) && value.is_null()) {
                return Ok(JsValue::UNDEFINED);
            }
        }

        match &self.inner {
            SchemaType::String {
                min_len,
                max_len,
                format,
                coerce,
            } => {
                let val_str = if value.is_string() {
                    value.as_string().unwrap()
                } else if *coerce {
                    value.as_string().unwrap_or_else(|| format!("{:?}", value))
                } else {
                    return Err(vec![Issue {
                        message: format!("Expected string, received {:?}", value),
                        path,
                    }]);
                };

                if let Some(min) = min_len {
                    if val_str.len() < *min {
                        return Err(vec![Issue {
                            message: format!("String shorter than {}", min),
                            path,
                        }]);
                    }
                }
                if let Some(max) = max_len {
                    if val_str.len() > *max {
                        return Err(vec![Issue {
                            message: format!("String longer than {}", max),
                            path,
                        }]);
                    }
                }

                if let Some(fmt) = format {
                    let valid = match fmt {
                        StringFormat::Uuid => Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$").unwrap().is_match(&val_str),
                        StringFormat::Email => Regex::new(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").unwrap().is_match(&val_str),
                        StringFormat::Phone => Regex::new(r"^\+?[0-9]{7,15}$").unwrap().is_match(&val_str),
                        StringFormat::Regex(p) => Regex::new(p).map(|r| r.is_match(&val_str)).unwrap_or(false),
                        StringFormat::Domain { require_protocol } => {
                            let r = if *require_protocol {
                                Regex::new(r"^https?://[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,6}$").unwrap()
                            } else {
                                Regex::new(r"^[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,6}$").unwrap()
                            };
                            r.is_match(&val_str)
                        }
                    };
                    if !valid {
                        return Err(vec![Issue {
                            message: "Invalid format".to_string(),
                            path,
                        }]);
                    }
                }

                Ok(JsValue::from(val_str))
            }
            SchemaType::Number { min, max, coerce } => {
                let val_num = if let Some(n) = value.as_f64() {
                    n
                } else if *coerce {
                    if let Some(s) = value.as_string() {
                        match s.parse::<f64>() {
                            Ok(n) => n,
                            Err(_) => {
                                return Err(vec![Issue {
                                    message: "Could not coerce to number".to_string(),
                                    path,
                                }])
                            }
                        }
                    } else {
                        return Err(vec![Issue {
                            message: "Expected number".to_string(),
                            path,
                        }]);
                    }
                } else {
                    return Err(vec![Issue {
                        message: "Expected number".to_string(),
                        path,
                    }]);
                };

                if let Some(m) = min {
                    if val_num < *m {
                        return Err(vec![Issue {
                            message: format!("Number less than {}", m),
                            path,
                        }]);
                    }
                }
                if let Some(m) = max {
                    if val_num > *m {
                        return Err(vec![Issue {
                            message: format!("Number greater than {}", m),
                            path,
                        }]);
                    }
                }
                Ok(JsValue::from(val_num))
            }
            SchemaType::Boolean { coerce } => {
                if value.is_truthy() && (value.as_bool().is_some() || *coerce) {
                    Ok(JsValue::from(value.is_truthy()))
                } else if !value.is_truthy() && (value.as_bool().is_some() || *coerce) {
                    Ok(JsValue::from(false))
                } else {
                    Err(vec![Issue {
                        message: "Expected boolean".to_string(),
                        path,
                    }])
                }
            }
            SchemaType::Literal { value: lit_val } => {
                if value == lit_val {
                    Ok(value.clone())
                } else {
                    Err(vec![Issue {
                        message: "Literal mismatch".to_string(),
                        path,
                    }])
                }
            }
            SchemaType::Null => {
                if value.is_null() {
                    Ok(JsValue::NULL)
                } else {
                    Err(vec![Issue {
                        message: "Expected null".to_string(),
                        path,
                    }])
                }
            }
            SchemaType::Any => Ok(value.clone()),
            SchemaType::Object { props } => {
                if !value.is_object() || js_sys::Array::is_array(value) {
                    return Err(vec![Issue {
                        message: "Expected object".to_string(),
                        path,
                    }]);
                }

                let result_obj = js_sys::Object::new();
                let mut issues = Vec::new();

                for (key, schema) in props {
                    let val =
                        js_sys::Reflect::get(value, &key.into()).unwrap_or(JsValue::UNDEFINED);

                    let mut current_path = path.clone().unwrap_or_default();
                    current_path.push(key.clone());

                    match schema.validate_inner(&val, Some(current_path.clone())) {
                        Ok(v) => {
                            js_sys::Reflect::set(&result_obj, &key.into(), &v).unwrap();
                        }
                        Err(mut sub_issues) => {
                            if val.is_undefined() && schema.is_optional {
                                continue;
                            }
                            if val.is_undefined() && !schema.is_optional {
                                issues.push(Issue {
                                    message: format!("Missing required property: {}", key),
                                    path: Some(current_path),
                                });
                            } else {
                                issues.append(&mut sub_issues);
                            }
                        }
                    }
                }

                if !issues.is_empty() {
                    Err(issues)
                } else {
                    Ok(result_obj.into())
                }
            }
            SchemaType::Array { item_schema } => {
                if !js_sys::Array::is_array(value) {
                    return Err(vec![Issue {
                        message: "Expected array".to_string(),
                        path,
                    }]);
                }
                let arr = js_sys::Array::from(value);
                let result_arr = js_sys::Array::new();
                let mut issues = Vec::new();

                for (i, val) in arr.iter().enumerate() {
                    let mut current_path = path.clone().unwrap_or_default();
                    current_path.push(i.to_string());

                    match item_schema.validate_inner(&val, Some(current_path)) {
                        Ok(v) => {
                            result_arr.push(&v);
                        }
                        Err(mut sub_issues) => {
                            issues.append(&mut sub_issues);
                        }
                    }
                }

                if !issues.is_empty() {
                    Err(issues)
                } else {
                    Ok(result_arr.into())
                }
            }
            SchemaType::Union { schemas } => {
                let mut all_issues = Vec::new();
                for schema in schemas {
                    match schema.validate_inner(value, path.clone()) {
                        Ok(val) => return Ok(val),
                        Err(mut issues) => all_issues.append(&mut issues),
                    }
                }
                Err(all_issues)
            }
            SchemaType::InstanceOf { ctor, name } => {
                if is_instance_of(value, ctor) {
                    Ok(value.clone())
                } else {
                    Err(vec![Issue {
                        message: format!("Expected instance of {}", name),
                        path,
                    }])
                }
            }
        }
    }
}
