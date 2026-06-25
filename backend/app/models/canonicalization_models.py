# models for canonnicalization

from pydantic import BaseModel, validator, Field
from typing import Optional, List, Tuple, Dict, Any, Union, Literal
from enum import Enum

class Category(str, Enum):
    """Enum for canonical categories"""
    NOTIFICATIONS = "Notifications"
    ACCOUNT_BALANCES = "Account/Balances"
    PERFORMANCE = "Performance"
    UPDATE_COMPATIBILITY = "Update/Compatibility"
    UX = "UX"
    AUTHENTICATION = "Authentication"
    SECURITY = "Security"
    CONNECTIVITY = "Connectivity"
    QUALITY = "Quality"
    MONITORING = "Monitoring"
    OTP = "OTP"
    SUPPORT = "Support"
    PAYMENTS = "Payments"
    KYC = "KYC"
    CARDS = "Cards"
    STABILITY = "Stability"
    FEATURE = "Feature"
    LOANS = "Loans"

class Subcategory(str, Enum):
    """Enum for canonical subcategories"""
    GENERAL = "General"
    VALUE = "Value"
    GAP = "Gap"
    USABILITY = "Usability"
    LOGIN = "Login"
    DELIVERY = "Delivery"
    API = "API"
    REGRESSION = "Regression"
    ONBOARDING = "Onboarding"
    OFFLINE = "Offline"
    REVERSALS = "Reversals"
    CRASH = "Crash"
    APPLICATION = "Application"
    VERIFICATION = "Verification"
    FLOW = "Flow"
    BIOMETRICS = "Biometrics"
    DESIGN = "Design"
    NAVIGATION = "Navigation"
    TESTING = "Testing"
    FEEDBACK = "Feedback"
    DEVICE = "Device"
    STARTUP = "Startup"
    ACCESSIBILITY = "Accessibility"
    PASSWORD_RESET = "Password Reset"
    INTERACTION = "Interaction"
    LINKING = "Linking"
    STATEMENTS = "Statements"
    FEES = "Fees"
    RESPONSIVENESS = "Responsiveness"
    NETWORK = "Network"
    VALIDATION = "Validation"
    ERROR_HANDLING = "Error Handling"
    LAUNCH = "Launch"
    FREEZE = "Freeze"
    OPTIMIZATION = "Optimization"
    SESSION = "Session"
    RESOLUTION = "Resolution"
    ANALYTICS = "Analytics"
    RELIABILITY = "Reliability"
    BACKEND = "Backend"
    MOBILE = "Mobile"
    PERSONALIZATION = "Personalization"
    ACCURACY = "Accuracy"
    LIMITS = "Limits"
    DATABASE = "Database"
    TRUST = "Trust"
    MONITORING = "Monitoring"
    TRANSACTIONS = "Transactions"
    PROCESSING = "Processing"
    SYNC = "Sync"
    ENTRY = "Entry"

class canonical_fields(BaseModel):
    category: str  # Can be existing Category enum value OR new category name
    subcategory: str  # Can be existing Subcategory enum value OR new subcategory name
    sub_subcategory1: Optional[str] = None  # The sub-sub-category of the canonical id
    display_label: str  # What will be shown to user in frontend
    description: Optional[str] = None  # A description for the canonical id
    examples: Optional[List[str]] = None  # Examples of statements that can also refer to this canonical id
    aliases: Optional[List[str]] = None  # any aliases to the statements



class llm_output(BaseModel):
    canonical_id: str  # The canonical id that is chosen
    existing_canonical_id: bool  # Whether the canonical id is already in the database
    reasoning: str  # The reasoning for the choice
    error: Optional[str] = None  # The error if any
    canonical_fields: Optional[Dict[str, Any]] = None
    
    # @validator('canonical_fields')
    # def validate_canonical_fields(cls, v, values):
    #     """Validate that canonical_fields is provided when existing_canonical_id is False"""
    #     existing_canonical_id = values.get('existing_canonical_id')
    #     
    #     if existing_canonical_id is True and v is not None:
    #         raise ValueError("canonical_fields must be None when existing_canonical_id is True")
    #     
    #     if existing_canonical_id is False and v is None:
    #         raise ValueError("canonical_fields must be provided when existing_canonical_id is False")
    #     
    #     return v
 
class llm_input(BaseModel):
    statement: str
    enriched_candidates: Optional[List[Dict[str, Any]]] = None  # List of enriched candidates

class CanonicalizationResult(BaseModel):
    """Standardized result model for all canonicalization attempts"""
    
    # Core result
    canonical_id: Optional[str] = None
    existing_canonical_id: Optional[bool] = None
    confidence_score: Optional[float] = None
    
    # Source tracking
    source: Optional[Literal['exact_match', 'alias_match', 'hybrid_auto', 'llm_arbitration', 'new_creation']] = None
    
    # Processing details
    processing_time_ms: Optional[float] = None
    error: Optional[str] = None
    
    # LLM details (if used)
    llm_used: bool = False
    llm_input: Optional[Dict[str, Any]] = None
    llm_output: Optional[Dict[str, Any]] = None
    
    # Hybrid similarity details (if used)
    hybrid_candidates: Optional[List[Dict[str, Any]]] = None
    
    # Metadata
    input_statement: Optional[str] = None
    review_section: Optional[Literal['issues', 'positives', 'actions']] = None
    app_id: Optional[str] = None
    
    # Timestamp
    timestamp: Optional[str] = None

class node_history(BaseModel):
    node_name: str
    timestamp: str


class CanonicalizationState(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    
    input_statement: str
    canonical_id: Optional[str] = None
    existing_canonical_id: Optional[bool] = None
    source: Optional[str] = None
    confidence_score: Optional[float] = None
    candidates: List[Dict] = []
    llm_used: bool = False
    processing_time: float = 0.0
    error: List[Dict[str, Any]] = []    # Changed to List[Dict] for structured errors
    exact_match_result: Optional[str] = None
    exact_match_error: Optional[str] = None
    alias_match_result: Optional[str] = None
    alias_match_error: Optional[str] = None
    hybrid_similarity_result: Optional[List[Tuple[str, str, float, float, float]]] = None
    llm_with_examples_result: Optional[str] = None
    llm_without_examples_result: Optional[str] = None
    llm_with_examples_error: Optional[str] = None
    llm_without_examples_error: Optional[str] = None
    node_history: List['node_history'] = []
    lexical_similarity_result: Optional[List[Tuple[str, str, float]]] = None
    lexical_similarity_error: Optional[str] = None
    vector_similarity_result: Optional[List[Tuple[str, str, float]]] = None
    vector_similarity_error: Optional[str] = None
    enriched_candidates: Optional[List[Dict[str, Any]]] = None
    enrich_cid_error: Optional[str] = None
    hybrid_similarity_error: Optional[str] = None
    enrich_hybrid_results_error: Optional[str] = None
    enrich_hybrid_results_result: Optional[str] = None
    results: Optional[str] = None  # Simple result statement


  
 


