import React from 'react';
import CustomSelect from './common/CustomSelect';

const FilterTabs = ({ 
  selectedStatus, 
  setSelectedStatus, 
  sortBy, 
  setSortBy, 
  selectedDept, 
  setSelectedDept, 
  submissionSource = 'All',
  setSubmissionSource = () => {},
  categories = []
}) => {
  const defaultCategoryNames = [
    'Shortage',
    'Excess',
    'Mismatch',
    'Transport Related',
    'Quality Issues',
    'Design Change',
    'Packaging',
    'Length Issues'
  ];

  const fetchedCategoryNames = (categories || []).map(cat => typeof cat === 'string' ? cat : cat.name).filter(Boolean);
  const combinedCategoryNames = Array.from(new Set([...defaultCategoryNames, ...fetchedCategoryNames]));

  return (
    <section 
      style={{ 
        marginTop: '16px', 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center',
        flexWrap: 'wrap', 
        gap: '12px',
        width: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 30
      }}
    >
      {/* Custom dropdown selects */}
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          gap: '12px',
          justifyContent: 'flex-end'
        }}
      >
        {/* Dropdown 1: Submission Source */}
        <CustomSelect 
          label="Flow Source:"
          value={submissionSource}
          onChange={setSubmissionSource}
          align="left"
          style={{ minWidth: '220px' }}
          options={[
            { value: 'All', label: 'All Submission Methods' },
            { value: 'ocr', label: 'See Invoice Complaints' },
            { value: 'manual', label: 'See Manually Raised Complaints' }
          ]}
        />

        {/* Dropdown 2: Sort by */}
        <CustomSelect 
          label="Sort by:"
          value={sortBy}
          onChange={setSortBy}
          align="left"
          style={{ minWidth: '170px' }}
          options={[
            { value: 'Raised Date', label: 'Raised Date' },
            { value: 'ID', label: 'Complaint ID' },
            { value: 'Priority', label: 'Priority' },
            { value: 'Category', label: 'Category' }
          ]}
        />

        {/* Dropdown 3: Category */}
        <CustomSelect 
          label="Category:"
          value={selectedDept}
          onChange={setSelectedDept}
          align="right"
          style={{ minWidth: '180px' }}
          options={[
            { value: 'All', label: 'All' },
            ...combinedCategoryNames.map(name => ({ value: name, label: name }))
          ]}
        />

        {/* Dropdown 4: Status */}
        <CustomSelect 
          label="Status:"
          value={selectedStatus}
          onChange={setSelectedStatus}
          align="right"
          style={{ minWidth: '155px' }}
          options={[
            { value: 'All', label: 'All' },
            { value: 'Pending', label: 'Pending' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Escalated', label: 'Escalated' },
            { value: 'Completed', label: 'Completed' }
          ]}
        />
      </div>
    </section>
  );
};

export default FilterTabs;
